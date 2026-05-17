# Spring Security（按需启用）

## Maven 依赖

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-security</artifactId>
</dependency>

<!-- JWT（jjwt 0.12.5） -->
<dependency>
  <groupId>io.jsonwebtoken</groupId>
  <artifactId>jjwt-api</artifactId>
  <version>${jjwt.version}</version>
</dependency>
<dependency>
  <groupId>io.jsonwebtoken</groupId>
  <artifactId>jjwt-impl</artifactId>
  <version>${jjwt.version}</version>
  <scope>runtime</scope>
</dependency>
<dependency>
  <groupId>io.jsonwebtoken</groupId>
  <artifactId>jjwt-jackson</artifactId>
  <version>${jjwt.version}</version>
  <scope>runtime</scope>
</dependency>
```

## 无状态 REST JWT 配置

### JwtSecurityConfig

```java
// config/JwtSecurityConfig.java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class JwtSecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    public JwtSecurityConfig(JwtAuthenticationFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/**", "/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(new ProblemDetailAuthEntryPoint())
                .accessDeniedHandler(new ProblemDetailAccessDeniedHandler())
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
```

### JwtService

```java
// config/JwtService.java
@Service
public class JwtService {

    private final SecretKey secretKey;
    private final long expirationMs;

    public JwtService(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-ms:86400000}") long expirationMs) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String generateToken(String username) {
        return Jwts.builder()
            .subject(username)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expirationMs))
            .signWith(secretKey)
            .compact();
    }

    public String extractUsername(String token) {
        return getClaims(token).getSubject();
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        String username = extractUsername(token);
        return username.equals(userDetails.getUsername()) && !isTokenExpired(token);
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
            .verifyWith(secretKey)   // jjwt 0.12.x API（非 setSigningKey）
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    private boolean isTokenExpired(String token) {
        return getClaims(token).getExpiration().before(new Date());
    }
}
```

### JwtAuthenticationFilter

```java
// config/JwtAuthenticationFilter.java
@Component
class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;

    JwtAuthenticationFilter(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        var authHeader = req.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            chain.doFilter(req, res);
            return;
        }

        var token = authHeader.substring(7);
        try {
            var username = jwtService.extractUsername(token);
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                var userDetails = userDetailsService.loadUserByUsername(username);
                if (jwtService.isTokenValid(token, userDetails)) {
                    var auth = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                    auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(req));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        } catch (JwtException e) {
            // Token 无效：不设置 Authentication，后续由 authenticationEntryPoint 处理
        }
        chain.doFilter(req, res);
    }
}
```

### AuthController

```java
// auth/rest/controllers/AuthController.java（包级私有）
@RestController
@RequestMapping("/api/auth")
class AuthController {

    private final AuthenticationManager authManager;
    private final JwtService jwtService;

    AuthController(AuthenticationManager authManager, JwtService jwtService) {
        this.authManager = authManager;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    AuthResponse login(@RequestBody @Valid LoginRequest request) {
        authManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.email(), request.password()));
        var token = jwtService.generateToken(request.email());
        return new AuthResponse(token);
    }
}

record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}
record AuthResponse(String token) {}
```

## application.properties（Security）

```properties
# JWT 配置（生产从环境变量注入，不硬编码）
app.jwt.secret=${JWT_SECRET:dev-only-secret-at-least-256-bits-long!!}
app.jwt.expiration-ms=${JWT_EXPIRATION_MS:86400000}

# ProblemDetail 错误格式
spring.mvc.problemdetails.enabled=true

# 生产强制 HTTPS
# server.ssl.enabled=true
# security.require-ssl=true
```

## 方法级安全

```java
@Service
public class UserService {

    @PreAuthorize("hasRole('ADMIN') or #userId == authentication.name")
    @Transactional(readOnly = true)
    public UserResult getUserById(UserId userId) { ... }

    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public void deleteUser(UserId userId) { ... }
}
```

## 安全测试

```java
@WebMvcTest(UserController.class)
class UserControllerTest {

    @Autowired MockMvc mvc;
    @MockBean UserService userService;

    @Test
    @WithMockUser(roles = "USER")
    void getUser_authenticated() throws Exception {
        mvc.perform(get("/api/users/1"))
            .andExpect(status().isOk());
    }

    @Test
    void getUser_unauthenticated() throws Exception {
        mvc.perform(get("/api/users/1"))
            .andExpect(status().isUnauthorized());
    }
}
```

## 安全检查清单

- [ ] 密码使用 BCrypt 加密（`PasswordEncoder`）
- [ ] JWT secret 从环境变量注入，不硬编码在代码中
- [ ] 生产环境启用 HTTPS
- [ ] 无状态 REST：禁用 CSRF + `STATELESS` Session
- [ ] 敏感端点需认证（Actuator 在生产限制访问）
- [ ] 日志中不记录密码、token、PII
- [ ] API 响应中不暴露 `@Entity`（用 DTO）
- [ ] `@PreAuthorize` 精确控制权限
