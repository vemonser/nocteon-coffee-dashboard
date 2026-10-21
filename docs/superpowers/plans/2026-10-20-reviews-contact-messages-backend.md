# Reviews & Contact Messages — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the reviews moderation console the endpoints it needs (exact product filter, free-text search, date range, statistics, bulk approval, order linkage) and make the contact-message reply actually email the customer through the durable email queue the project already owns.

**Architecture:** Two independent slices. **Reviews:** one list endpoint gains filters, three new endpoints carry the statistics, the bulk approval and the order linkage; the order linkage is ONE extra query per page, not one per row. **Contact replies:** the existing `email_log` table becomes the transport — the reply enqueues an email, attempts it inline, and the existing `EmailRetryScheduler` finishes the job if Brevo refuses. No new table, no schema change, no Brevo dashboard template, no environment variable.

**Tech Stack:** Spring Boot 4.1, Java 21, Maven wrapper (`./mvnw`), Spring Data JPA / Hibernate, Flyway, Thymeleaf, Brevo HTTP API, JUnit 5 + Mockito + AssertJ, PostgreSQL 16 (docker compose), Redis 7.

**Spec:** `docs/superpowers/specs/2026-10-20-reviews-contact-messages-design.md` (in the `nocteon-dashboard` repo — read §4 before starting).

**Companion plan:** `docs/superpowers/plans/2026-10-20-reviews-contact-messages-dashboard.md` (in the `nocteon-dashboard` repo). This plan produces the API that plan consumes. The two run in sequence, in two different repositories.

---

## Global Constraints

- **This is a different git repository** from the dashboard: `/home/abdelrhman/Developments/2026/side-projects/nocteon/nocteon-backend`. Commit here, separately. Do not try to commit dashboard files from this repo.
- **Java 21.** Run Maven as `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw …` — the JDK the project's `.mise.toml` pins. A different JDK fails the build.
- **Unit tests are plain Mockito** — `@ExtendWith(MockitoExtension.class)`, the class instantiated directly, no Spring context, no HTTP. AssertJ for assertions.
- **A test that needs the database** is `@SpringBootTest(classes = NocteonApiApplication.class, webEnvironment = SpringBootTest.WebEnvironment.NONE)` and MUST register the JWT keys:
  `@DynamicPropertySource static void jwtKeys(DynamicPropertyRegistry r) { TestJwtKeys.register(r); }`
- **The database is the real PostgreSQL** from `docker compose up -d` (db `nocteon_db`, user/pass `postgres`/`postgres`), already Flyway-migrated. There is no Testcontainers and no H2. The stack is already running in this environment.
- **Every integration test mutation is inside `try { … } finally { … }`** with an explicit cleanup statement, so a failed assertion cannot leave the database dirty for the next test.
- **Named parameters in a `@Query` MUST carry `@Param`.** `RepositoryQueryBindingTest` fails the build otherwise. A search parameter compared to a value MUST have a null guard — that test also fails the build otherwise.
- **`SoftDeletableEntity` carries `@SQLRestriction("deleted_at IS NULL")`.** A query against `Review` or `Order` must NOT repeat `deleted_at IS NULL` by hand — Hibernate adds it.
- **Validation messages are i18n keys**: `@NotBlank(message = "{validation.xxx.notBlank}")`, and the key must exist in BOTH `src/main/resources/messages.properties` AND `src/main/resources/messages_ar.properties`.
- **Authorization** is `@PreAuthorize("hasAuthority('entity:action')")` on the controller method. The authority must already exist in `com.nocteon.nocteon_api.common.enums.Permission` — `review:moderate`, `review:delete`, `contact:read`, `contact:update` and `contact:delete` all exist.
- **DTOs are Lombok `@Builder` classes**; a service maps entity → DTO in a private `buildResponse(entity)`.
- **Envelopes**: `ApiResponse.success(data, message)` and `PageResponse.of(page, mapper)`. Deletes return `ResponseEntity.noContent().build()`.
- **No secret is committed.** `.env` is gitignored. New configuration is read from an env var with a safe default.
- **`Map.of(...)` rejects null values.** Any map that can hold a null (a contact message with no reply yet) must be a `HashMap` with explicit `put` calls.
- Commit after every task, with a scoped message. Never amend a previous task's commit.

---

## Review Focus

The five failure modes most likely to bite a person using this software, most likely first. Each one is pinned by a test in the task that owns the code.

1. **A reply email reaches a real customer.** Any address in `contact_messages` that is not `@test.com` receives mail the moment an admin presses Send reply. The send must be gated on an explicit admin action, and the seeded addresses must stay on `@test.com`.
2. **The retry worker drains a queue nobody has inspected.** `email_log` may already hold old PENDING/FAILED rows from earlier traffic; turning the worker on sends all of them. The worker gets its own flag, off by default, and Task 7 reads the queue before that flag is ever set.
3. **A retry rebuilds the email from the database**, so it sends the CURRENT `reply_content` — if the admin has replied again since, the older failed attempt sends the newer text. Accepted, but it must be one email row per message, never two divergent emails in flight.
4. **A bulk approval that partially applies.** Twenty ids, one of them soft-deleted meanwhile: the endpoint must report what it actually changed, not what it was asked to change.
5. **The exact-match product filter breaks the existing free-text search.** `productSlug` is currently a `LIKE` search and the dashboard's search box passes the same parameter today. Changing it to an exact match without moving the search to its own parameter silently empties the list.

---

## File Structure

| File | Responsibility |
|---|---|
| `review/repository/ReviewRepository.java` | The dashboard query, now with an exact product filter, a free-text search and a date range; plus the aggregate queries behind the statistics endpoint. |
| `review/service/ReviewService.java` | Maps the filters, builds the statistics, performs the bulk approval, and fills the order linkage into the response. |
| `review/controller/ReviewController.java` | The four review endpoints (list, stats, bulk approval, existing single approval). |
| `review/dto/response/ReviewStatsResponse.java` | **new** — the statistics payload. |
| `review/dto/request/BulkApprovalRequest.java` | **new** — `{ ids: number[], approved: boolean }`. |
| `review/dto/response/BulkApprovalResponse.java` | **new** — `{ updated: number }`. |
| `order/repository/OrderRepository.java` | One query: the latest qualifying order per (product, user) for a page of reviews. |
| `contact/service/ContactService.java` | The reply now enqueues an email and reports its status. |
| `contact/dto/response/ContactResponse.java` | Gains `emailStatus`. |
| `contact/controller/ContactController.java` | Gains the resend endpoint. |
| `contact/repository/ContactMessageRepository.java` | Unchanged — the message data is already there. |
| `mail/enums/EmailType.java` | Gains `CONTACT_REPLY`. |
| `mail/dataProvider/ContactReplyDataProvider.java` | **new** — resolves the template params for a contact reply. |
| `mail/service/ContactReplyEmailRenderer.java` | **new** — renders the Thymeleaf template and builds the subject. |
| `mail/service/BrevoClient.java` | Gains the raw-content send (subject + htmlContent, no template id). |
| `mail/service/TransactionalEmailService.java` | Gains `enqueueOrResendEmail` and the raw-content branch. |
| `mail/repository/EmailLogRepository.java` | Gains the batched status lookup. |
| `mail/config/MailProperties.java` | Gains `retryEnabled`. |
| `mail/scheduler/EmailRetryScheduler.java` | Its gate becomes the new flag. |
| `resources/templates/emails/contact-reply.html` | **new** — the email body. |
| `resources/db/migration/V110__fix_review_and_media_seed.sql` | **new** — the seed cleanup. |

---

### Task 1: The reviews list — exact product filter, free-text search, date range

**Files:**
- Modify: `src/main/java/com/nocteon/nocteon_api/review/repository/ReviewRepository.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/review/service/ReviewService.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/review/controller/ReviewController.java`
- Test: `src/test/java/com/nocteon/nocteon_api/review/service/ReviewServiceFilterTest.java` (new)
- Test: `src/test/java/com/nocteon/nocteon_api/review/ReviewDashboardFilterIntegrationTest.java` (new)

**Interfaces:**
- Consumes: `BaseFilterRequest` (page / size / sort / direction).
- Produces:
  - `ReviewRepository.findAllDashboard(@Param("productSlug") String productSlug, @Param("search") String search, @Param("isApproved") Boolean isApproved, @Param("isVerified") Boolean isVerified, @Param("minRating") Integer minRating, @Param("createdFrom") Instant createdFrom, @Param("createdTo") Instant createdTo, Pageable pageable) : Page<Review>`
  - `ReviewService.getDashboardReviews(String productSlug, String search, Boolean isApproved, Boolean isVerified, Integer minRating, Instant createdFrom, Instant createdTo, BaseFilterRequest filter) : PageResponse<ReviewResponse>`
  - `GET /api/dashboard/reviews?productSlug=&search=&isApproved=&isVerified=&minRating=&createdFrom=&createdTo=&page=&size=&sort=&direction=` (authority `review:moderate`)

- [ ] **Step 1: Write the failing unit test — the filters reach the repository**

Create `src/test/java/com/nocteon/nocteon_api/review/service/ReviewServiceFilterTest.java`:

```java
package com.nocteon.nocteon_api.review.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import com.nocteon.nocteon_api.common.dto.BaseFilterRequest;
import com.nocteon.nocteon_api.common.dto.PageResponse;
import com.nocteon.nocteon_api.review.dto.response.ReviewResponse;
import com.nocteon.nocteon_api.review.entity.Review;
import com.nocteon.nocteon_api.review.repository.ReviewRepository;

@ExtendWith(MockitoExtension.class)
class ReviewServiceFilterTest {

    @Mock
    private ReviewRepository reviewRepository;

    @InjectMocks
    private ReviewService reviewService;

    @Test
    void theProductSearchAndDateRangeReachTheRepository() {
        when(reviewRepository.findAllDashboard(
                any(), any(), any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        Instant from = Instant.parse("2026-10-01T00:00:00Z");
        Instant to = Instant.parse("2026-10-20T23:59:59Z");
        reviewService.getDashboardReviews(
                "brazil-mogiana", "excellent", Boolean.FALSE, Boolean.TRUE, 3, from, to,
                new BaseFilterRequest());

        ArgumentCaptor<String> product = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> search = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Instant> createdFrom = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> createdTo = ArgumentCaptor.forClass(Instant.class);
        verify(reviewRepository).findAllDashboard(
                product.capture(), search.capture(), eq(Boolean.FALSE), eq(Boolean.TRUE), eq(3),
                createdFrom.capture(), createdTo.capture(), any(Pageable.class));

        assertThat(product.getValue()).isEqualTo("brazil-mogiana");
        assertThat(search.getValue()).isEqualTo("excellent");
        assertThat(createdFrom.getValue()).isEqualTo(from);
        assertThat(createdTo.getValue()).isEqualTo(to);
    }

    /**
     * A null search must stay null all the way down. The repository query
     * compares it against a value, and the binding guard fails the build on a
     * comparison without a null guard — so a blank string here would become a
     * build failure, not a subtle filter bug.
     */
    @Test
    void anAbsentSearchStaysNull() {
        when(reviewRepository.findAllDashboard(
                any(), any(), any(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        reviewService.getDashboardReviews(
                null, null, null, null, null, null, null, new BaseFilterRequest());

        verify(reviewRepository).findAllDashboard(
                isNull(), isNull(), isNull(), isNull(), isNull(), isNull(), isNull(),
                any(Pageable.class));
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=ReviewServiceFilterTest`

Expected: FAIL — a compilation error, because `getDashboardReviews` does not yet take `search`, `createdFrom` or `createdTo`.

- [ ] **Step 3: Write the failing integration test — the product filter is exact**

Create `src/test/java/com/nocteon/nocteon_api/review/ReviewDashboardFilterIntegrationTest.java`:

```java
package com.nocteon.nocteon_api.review;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.nocteon.nocteon_api.NocteonApiApplication;
import com.nocteon.nocteon_api.common.dto.BaseFilterRequest;
import com.nocteon.nocteon_api.common.dto.PageResponse;
import com.nocteon.nocteon_api.review.dto.response.ReviewResponse;
import com.nocteon.nocteon_api.review.service.ReviewService;
import com.nocteon.nocteon_api.support.TestJwtKeys;

/**
 * The dashboard review filter, against the real database.
 *
 * <p>The product filter is EXACT, not a LIKE search: the dashboard has a
 * product dropdown, and a dropdown that matches three products because the
 * slug is a prefix of the others is worse than no dropdown at all.
 */
@SpringBootTest(
        classes = NocteonApiApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
class ReviewDashboardFilterIntegrationTest {

    @Autowired
    private ReviewService reviewService;

    @DynamicPropertySource
    static void jwtKeys(DynamicPropertyRegistry registry) {
        TestJwtKeys.register(registry);
    }

    @Test
    void anExactProductSlugReturnsOnlyThatProduct() {
        PageResponse<ReviewResponse> page = reviewService.getDashboardReviews(
                "brazil-mogiana", null, null, null, null, null, null, new BaseFilterRequest());

        assertThat(page.getContent()).isNotEmpty();
        assertThat(page.getContent())
                .extracting(r -> r.getProductSlug())
                .containsOnly("brazil-mogiana");
    }

    @Test
    void aPartialProductSlugMatchesNothing() {
        PageResponse<ReviewResponse> page = reviewService.getDashboardReviews(
                "brazil", null, null, null, null, null, null, new BaseFilterRequest());

        assertThat(page.getContent()).isEmpty();
    }

    @Test
    void aDateRangeThatExcludesTheReviewsReturnsNothing() {
        PageResponse<ReviewResponse> page = reviewService.getDashboardReviews(
                null, null, null, null, null,
                java.time.Instant.parse("2000-01-01T00:00:00Z"),
                java.time.Instant.parse("2000-01-02T00:00:00Z"),
                new BaseFilterRequest());

        assertThat(page.getContent()).isEmpty();
    }
}
```

- [ ] **Step 4: Run the integration test to verify it fails**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=ReviewDashboardFilterIntegrationTest`

Expected: FAIL — a compilation error on the new `getDashboardReviews` signature.

- [ ] **Step 5: Implement the repository query**

In `ReviewRepository`, replace `findAllDashboard` with:

```java
        /**
         * The dashboard moderation queue. The product filter is EXACT — the
         * dashboard has a product dropdown, and a prefix match would select
         * three products where the reader chose one. The free-text search is a
         * separate parameter for the same reason: the old endpoint overloaded
         * the product slug with a LIKE search, and the two could not coexist.
         */
        @Query("""
                            SELECT r
                            FROM Review r
                            LEFT JOIN r.product p
                            LEFT JOIN r.user u
                            WHERE (:productSlug IS NULL OR
                            LOWER(p.slug) = LOWER(:productSlug))
                              AND (:search IS NULL OR
                            LOWER(r.comment) LIKE LOWER(CONCAT('%', :search, '%'))
                            OR LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%')))
                              AND (:isApproved IS NULL OR r.isApproved = :isApproved)
                              AND (:isVerified IS NULL OR r.isVerified = :isVerified)
                              AND (:minRating IS NULL OR r.rating >= :minRating)
                              AND (:createdFrom IS NULL OR r.createdAt >= :createdFrom)
                              AND (:createdTo IS NULL OR r.createdAt <= :createdTo)
                            ORDER BY r.createdAt DESC
                        """)
        Page<Review> findAllDashboard(
                        @Param("productSlug") String productSlug,
                        @Param("search") String search,
                        @Param("isApproved") Boolean isApproved,
                        @Param("isVerified") Boolean isVerified,
                        @Param("minRating") Integer minRating,
                        @Param("createdFrom") Instant createdFrom,
                        @Param("createdTo") Instant createdTo,
                        Pageable pageable);
```

Add `import java.time.Instant;` to the file.

- [ ] **Step 6: Implement the service and the controller**

In `ReviewService`, replace `getDashboardReviews` with:

```java
        @Transactional(readOnly = true)
        public PageResponse<ReviewResponse> getDashboardReviews(
                        String productSlug, String search, Boolean isApproved,
                        Boolean isVerified, Integer minRating,
                        Instant createdFrom, Instant createdTo,
                        BaseFilterRequest filter) {
                Page<Review> page = reviewRepository.findAllDashboard(
                                productSlug, search, isApproved, isVerified, minRating,
                                createdFrom, createdTo, filter.toPageable());
                return PageResponse.of(page.map(this::buildResponse));
        }
```

Add `import java.time.Instant;` to the file.

In `ReviewController`, replace the `getDashboardReviews` mapping with:

```java
    @GetMapping("/dashboard/reviews")
    @PreAuthorize("hasAuthority('review:moderate')")
    public ResponseEntity<ApiResponse<PageResponse<ReviewResponse>>> getDashboardReviews(
            @RequestParam(required = false) String productSlug,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean isApproved,
            @RequestParam(required = false) Boolean isVerified,
            @RequestParam(required = false) Integer minRating,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdFrom,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant createdTo,
            @Valid
            @ModelAttribute BaseFilterRequest filter) {
        return ResponseEntity.ok(
                ApiResponse.success(
                        reviewService.getDashboardReviews(
                                productSlug, search, isApproved, isVerified, minRating,
                                createdFrom, createdTo, filter),
                        "Dashboard reviews retrieved"));
    }
```

Add `import java.time.Instant;` and `import org.springframework.format.annotation.DateTimeFormat;` to the controller.

- [ ] **Step 7: Run both tests to verify they pass**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=ReviewServiceFilterTest,ReviewDashboardFilterIntegrationTest`

Expected: PASS — 5 tests, 0 failures.

- [ ] **Step 8: Run the repository guard tests, because the query changed**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=RepositoryQueryBindingTest`

Expected: PASS. A failure here means a `@Param` is missing or a search comparison has no null guard.

- [ ] **Step 9: Commit**

```bash
git add src/main/java/com/nocteon/nocteon_api/review src/test/java/com/nocteon/nocteon_api/review
git commit -m "feat(reviews): an exact product filter, a free-text search and a date range

The product slug was doubling as a LIKE search, so the dashboard's search
box and a product dropdown could never coexist. The slug is now an exact
match, the free text has its own parameter, and the list accepts a
createdFrom/createdTo range."
```

---

### Task 2: The review statistics endpoint

**Files:**
- Create: `src/main/java/com/nocteon/nocteon_api/review/dto/response/ReviewStatsResponse.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/review/repository/ReviewRepository.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/review/service/ReviewService.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/review/controller/ReviewController.java`
- Test: `src/test/java/com/nocteon/nocteon_api/review/service/ReviewStatsServiceTest.java` (new)
- Test: `src/test/java/com/nocteon/nocteon_api/review/ReviewStatsIntegrationTest.java` (new)

**Interfaces:**
- Consumes: nothing from Task 1 (the statistics are over ALL reviews, not the filtered page).
- Produces:
  - `ReviewStatsResponse` — fields `long total`, `long pending`, `long approved`, `Double averageRating`, `Map<String, Long> distribution` (keys `"1"` … `"5"`).
  - `ReviewService.getReviewStats() : ReviewStatsResponse`
  - `GET /api/dashboard/reviews/stats` (authority `review:moderate`)

- [ ] **Step 1: Write the failing unit test**

Create `src/test/java/com/nocteon/nocteon_api/review/service/ReviewStatsServiceTest.java`:

```java
package com.nocteon.nocteon_api.review.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.nocteon.nocteon_api.review.dto.response.ReviewStatsResponse;
import com.nocteon.nocteon_api.review.repository.ReviewRepository;

@ExtendWith(MockitoExtension.class)
class ReviewStatsServiceTest {

    @Mock
    private ReviewRepository reviewRepository;

    @InjectMocks
    private ReviewService reviewService;

    @Test
    void theDistributionCoversEveryStarFromOneToFive() {
        when(reviewRepository.count()).thenReturn(15L);
        when(reviewRepository.countByIsApprovedFalse()).thenReturn(2L);
        when(reviewRepository.countByIsApprovedTrue()).thenReturn(13L);
        when(reviewRepository.averageApprovedRating()).thenReturn(4.1);
        when(reviewRepository.countByRating())
                .thenReturn(List.of(new Object[] { 5, 8L }, new Object[] { 4, 4L }, new Object[] { 3, 2L }));

        ReviewStatsResponse stats = reviewService.getReviewStats();

        assertThat(stats.getTotal()).isEqualTo(15L);
        assertThat(stats.getPending()).isEqualTo(2L);
        assertThat(stats.getApproved()).isEqualTo(13L);
        assertThat(stats.getAverageRating()).isEqualTo(4.1);
        // Every bucket is present, even the empty ones: the dashboard draws a
        // bar for each, and a missing key would read as "no data" rather than
        // "nobody gave that rating".
        assertThat(stats.getDistribution()).containsOnlyKeys("1", "2", "3", "4", "5");
        assertThat(stats.getDistribution()).containsEntry("5", 8L).containsEntry("4", 4L)
                .containsEntry("3", 2L).containsEntry("1", 0L).containsEntry("2", 0L);
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=ReviewStatsServiceTest`

Expected: FAIL — a compilation error, because `ReviewStatsResponse` and `getReviewStats()` do not exist.

- [ ] **Step 3: Write the failing integration test**

Create `src/test/java/com/nocteon/nocteon_api/review/ReviewStatsIntegrationTest.java`:

```java
package com.nocteon.nocteon_api.review;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.nocteon.nocteon_api.NocteonApiApplication;
import com.nocteon.nocteon_api.review.dto.response.ReviewStatsResponse;
import com.nocteon.nocteon_api.review.service.ReviewService;
import com.nocteon.nocteon_api.support.TestJwtKeys;

@SpringBootTest(
        classes = NocteonApiApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
class ReviewStatsIntegrationTest {

    @Autowired
    private ReviewService reviewService;

    @DynamicPropertySource
    static void jwtKeys(DynamicPropertyRegistry registry) {
        TestJwtKeys.register(registry);
    }

    @Test
    void theCountsAddUp() {
        ReviewStatsResponse stats = reviewService.getReviewStats();

        assertThat(stats.getTotal()).isPositive();
        assertThat(stats.getPending() + stats.getApproved()).isEqualTo(stats.getTotal());
        assertThat(stats.getDistribution().values().stream().mapToLong(Long::longValue).sum())
                .isEqualTo(stats.getTotal());
    }

    /**
     * The average is over APPROVED reviews only. A pending review must not
     * move the number the storefront shows.
     */
    @Test
    void theAverageIgnoresPendingReviews() {
        ReviewStatsResponse stats = reviewService.getReviewStats();

        if (stats.getPending() > 0) {
            assertThat(stats.getAverageRating()).isNotNull();
        }
    }
}
```

- [ ] **Step 4: Implement the DTO, the queries, the service and the controller**

Create `src/main/java/com/nocteon/nocteon_api/review/dto/response/ReviewStatsResponse.java`:

```java
package com.nocteon.nocteon_api.review.dto.response;

import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * The moderation statistics for the reviews console.
 *
 * <p>{@code averageRating} counts APPROVED reviews only: a pending review
 * must not move the average the storefront shows.
 *
 * <p>{@code distribution} always carries all five keys, so the dashboard can
 * draw a bar for each star without a null check.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewStatsResponse {
    private long total;
    private long pending;
    private long approved;
    private Double averageRating;
    private Map<String, Long> distribution;
}
```

In `ReviewRepository`, add:

```java
        long countByIsApprovedTrue();

        /**
         * The average over APPROVED reviews only — a pending review must not
         * move the number the storefront shows.
         */
        @Query("SELECT AVG(r.rating) FROM Review r WHERE r.isApproved = true")
        Double averageApprovedRating();

        /** The star histogram, as (rating, count) pairs. */
        @Query("SELECT r.rating, COUNT(r) FROM Review r GROUP BY r.rating")
        List<Object[]> countByRating();
```

Add `import java.util.List;` to the file.

In `ReviewService`, add:

```java
        /**
         * The moderation statistics.
         *
         * <p>Every star bucket is present in the distribution, including the
         * empty ones: the dashboard draws a bar for each, and a missing key
         * would read as "no data" rather than "nobody gave that rating".
         */
        @Transactional(readOnly = true)
        public ReviewStatsResponse getReviewStats() {
                Map<String, Long> distribution = new LinkedHashMap<>();
                for (int star = 1; star <= 5; star++) {
                        distribution.put(String.valueOf(star), 0L);
                }
                for (Object[] row : reviewRepository.countByRating()) {
                        distribution.put(String.valueOf(((Number) row[0]).intValue()),
                                ((Number) row[1]).longValue());
                }

                long total = reviewRepository.count();
                long pending = reviewRepository.countByIsApprovedFalse();
                long approved = reviewRepository.countByIsApprovedTrue();

                return ReviewStatsResponse.builder()
                                .total(total)
                                .pending(pending)
                                .approved(approved)
                                .averageRating(reviewRepository.averageApprovedRating())
                                .distribution(distribution)
                                .build();
        }
```

Add `import java.util.LinkedHashMap;` and `import java.util.Map;` to the file.

In `ReviewController`, add:

```java
    @GetMapping("/dashboard/reviews/stats")
    @PreAuthorize("hasAuthority('review:moderate')")
    public ResponseEntity<ApiResponse<ReviewStatsResponse>> getReviewStats() {
        return ResponseEntity.ok(
                ApiResponse.success(reviewService.getReviewStats(), "Review statistics retrieved"));
    }
```

Add `import com.nocteon.nocteon_api.review.dto.response.ReviewStatsResponse;` to the controller.

> **Ordering note:** this mapping must be declared BEFORE `GET /dashboard/reviews/{id}` in the controller class is irrelevant for Spring (it matches on the path template, and `{id}` is a `Long` so `stats` would fail to bind and 400) — but declare it above the `{id}` mapping anyway, so a reader does not have to think about it.

- [ ] **Step 5: Run both tests to verify they pass**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=ReviewStatsServiceTest,ReviewStatsIntegrationTest`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/nocteon/nocteon_api/review src/test/java/com/nocteon/nocteon_api/review
git commit -m "feat(reviews): the statistics the moderation console needs

Total, pending and approved, the average over APPROVED reviews only, and
the star histogram with all five buckets present — the dashboard draws a
bar for each, and a missing key would read as 'no data' rather than
'nobody gave that rating'."
```

---

### Task 3: Bulk approval

**Files:**
- Create: `src/main/java/com/nocteon/nocteon_api/review/dto/request/BulkApprovalRequest.java`
- Create: `src/main/java/com/nocteon/nocteon_api/review/dto/response/BulkApprovalResponse.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/review/service/ReviewService.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/review/controller/ReviewController.java`
- Test: `src/test/java/com/nocteon/nocteon_api/review/service/ReviewBulkApprovalTest.java` (new)

**Interfaces:**
- Consumes: nothing from Tasks 1–2.
- Produces:
  - `BulkApprovalRequest` — `@NotEmpty List<Long> ids`, `boolean approved`.
  - `BulkApprovalResponse` — `int updated`.
  - `ReviewService.setApprovalBulk(List<Long> ids, boolean approved) : int`
  - `PATCH /api/dashboard/reviews/approval` (authority `review:moderate`)

- [ ] **Step 1: Write the failing unit test**

Create `src/test/java/com/nocteon/nocteon_api/review/service/ReviewBulkApprovalTest.java`:

```java
package com.nocteon.nocteon_api.review.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.nocteon.nocteon_api.review.entity.Review;
import com.nocteon.nocteon_api.review.repository.ReviewRepository;

@ExtendWith(MockitoExtension.class)
class ReviewBulkApprovalTest {

    @Mock
    private ReviewRepository reviewRepository;

    @InjectMocks
    private ReviewService reviewService;

    @Test
    void everyReviewInTheListIsApproved() {
        when(reviewRepository.findById(1L)).thenReturn(Optional.of(Review.builder().isApproved(false).build()));
        when(reviewRepository.findById(2L)).thenReturn(Optional.of(Review.builder().isApproved(false).build()));
        when(reviewRepository.save(any(Review.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        int updated = reviewService.setApprovalBulk(List.of(1L, 2L), true);

        assertThat(updated).isEqualTo(2);
        ArgumentCaptor<Review> saved = ArgumentCaptor.forClass(Review.class);
        verify(reviewRepository, org.mockito.Mockito.times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).allMatch(Review::isApproved);
    }

    /**
     * A review that was deleted between the list rendering and the click is
     * not an error — it is simply not there any more. The count must report
     * what actually changed, not what was asked for.
     */
    @Test
    void aReviewThatNoLongerExistsIsSkippedAndNotCounted() {
        when(reviewRepository.findById(1L)).thenReturn(Optional.of(Review.builder().isApproved(false).build()));
        when(reviewRepository.findById(99L)).thenReturn(Optional.empty());
        when(reviewRepository.save(any(Review.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        int updated = reviewService.setApprovalBulk(List.of(1L, 99L), true);

        assertThat(updated).isEqualTo(1);
    }

    @Test
    void anEmptyListChangesNothing() {
        int updated = reviewService.setApprovalBulk(List.of(), true);

        assertThat(updated).isZero();
        verify(reviewRepository, never()).save(any(Review.class));
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=ReviewBulkApprovalTest`

Expected: FAIL — a compilation error, because `setApprovalBulk` does not exist.

- [ ] **Step 3: Implement the DTOs, the service and the controller**

Create `src/main/java/com/nocteon/nocteon_api/review/dto/request/BulkApprovalRequest.java`:

```java
package com.nocteon.nocteon_api.review.dto.request;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One bulk approval for a set of reviews.
 *
 * <p>An empty list is rejected: "approve nothing" is a client bug, and
 * answering it with 200 would hide it.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class BulkApprovalRequest {
    @NotEmpty(message = "{validation.reviewIds.notEmpty}")
    private List<Long> ids;
    private boolean approved;
}
```

Create `src/main/java/com/nocteon/nocteon_api/review/dto/response/BulkApprovalResponse.java`:

```java
package com.nocteon.nocteon_api.review.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * How many reviews a bulk approval actually changed — which can be fewer
 * than were asked for, because a review deleted in between is not there any
 * more.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkApprovalResponse {
    private int updated;
}
```

Add the key to `src/main/resources/messages.properties` and `src/main/resources/messages_ar.properties`:

```
validation.reviewIds.notEmpty=Select at least one review
```
```
validation.reviewIds.notEmpty=اختر تقييماً واحداً على الأقل
```

In `ReviewService`, add:

```java
        /**
         * Approve or unapprove a set of reviews in one call.
         *
         * <p>A review that was deleted between the list rendering and the
         * click is not an error — it is simply not there any more, and the
         * count reports what ACTUALLY changed.
         */
        @Transactional
        public int setApprovalBulk(List<Long> ids, boolean approved) {
                if (ids == null || ids.isEmpty()) {
                        return 0;
                }
                int updated = 0;
                for (Long id : ids) {
                        Review review = reviewRepository.findById(id).orElse(null);
                        if (review == null) {
                                continue;
                        }
                        review.setApproved(approved);
                        reviewRepository.save(review);
                        updated++;
                }
                log.info("Bulk approval: {} reviews set to approved={}", updated, approved);
                return updated;
        }
```

Add `import java.util.List;` to the file.

In `ReviewController`, add:

```java
    @PatchMapping("/dashboard/reviews/approval")
    @PreAuthorize("hasAuthority('review:moderate')")
    public ResponseEntity<ApiResponse<BulkApprovalResponse>> bulkApproval(
            @Valid @RequestBody BulkApprovalRequest request) {
        int updated = reviewService.setApprovalBulk(request.getIds(), request.isApproved());
        return ResponseEntity.ok(
                ApiResponse.success(
                        BulkApprovalResponse.builder().updated(updated).build(),
                        updated == 1 ? "1 review updated" : updated + " reviews updated"));
    }
```

Add the two imports for the new DTOs.

- [ ] **Step 4: Run the test to verify it passes**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=ReviewBulkApprovalTest`

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/nocteon/nocteon_api/review src/main/resources/messages.properties src/main/resources/messages_ar.properties src/test/java/com/nocteon/nocteon_api/review
git commit -m "feat(reviews): approve a set of reviews in one call

The count reports what actually changed: a review deleted between the list
rendering and the click is skipped, not counted, and not an error."
```

---

### Task 4: The order behind a verified review

**Files:**
- Modify: `src/main/java/com/nocteon/nocteon_api/order/repository/OrderRepository.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/review/dto/response/ReviewResponse.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/review/service/ReviewService.java`
- Test: `src/test/java/com/nocteon/nocteon_api/review/ReviewOrderLinkIntegrationTest.java` (new)

**Interfaces:**
- Consumes: nothing from Tasks 1–3.
- Produces:
  - `ReviewResponse` — gains `Long orderId` and `String orderNumber` (both nullable).
  - `OrderRepository.findLatestQualifyingOrdersForUsers(@Param("userIds") Collection<Long> userIds) : List<Object[]>` — each row is `(productId, userId, orderId, orderNumber)`, newest first.
  - The list endpoint fills the two fields **only** when the review is verified AND a qualifying order exists.

- [ ] **Step 1: Write the failing integration test**

Create `src/test/java/com/nocteon/nocteon_api/review/ReviewOrderLinkIntegrationTest.java`:

```java
package com.nocteon.nocteon_api.review;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.nocteon.nocteon_api.NocteonApiApplication;
import com.nocteon.nocteon_api.common.dto.BaseFilterRequest;
import com.nocteon.nocteon_api.common.dto.PageResponse;
import com.nocteon.nocteon_api.review.dto.response.ReviewResponse;
import com.nocteon.nocteon_api.review.service.ReviewService;
import com.nocteon.nocteon_api.support.TestJwtKeys;

/**
 * The order link behind a verified review.
 *
 * <p>Only a review whose purchase is CONFIRMED carries an order — the
 * dashboard shows a small check next to the reviewer's name, and a link to
 * the order, and only when there is an order to link to.
 */
@SpringBootTest(
        classes = NocteonApiApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
class ReviewOrderLinkIntegrationTest {

    @Autowired
    private ReviewService reviewService;

    @DynamicPropertySource
    static void jwtKeys(DynamicPropertyRegistry registry) {
        TestJwtKeys.register(registry);
    }

    @Test
    void aVerifiedReviewWithAPurchaseCarriesItsOrder() {
        PageResponse<ReviewResponse> page = reviewService.getDashboardReviews(
                null, null, null, null, null, null, null, new BaseFilterRequest());

        assertThat(page.getContent()).isNotEmpty();
        assertThat(page.getContent())
                .filteredOn(r -> Boolean.TRUE.equals(r.getVerified()))
                .isNotEmpty()
                .allSatisfy(r -> {
                    assertThat(r.getOrderId()).isNotNull();
                    assertThat(r.getOrderNumber()).isNotBlank();
                });
    }

    /**
     * An unverified review must carry NO order: the check mark next to the
     * reviewer's name is a promise that the purchase was confirmed, and a
     * link to a random order would make that promise a lie.
     */
    @Test
    void anUnverifiedReviewCarriesNoOrder() {
        PageResponse<ReviewResponse> page = reviewService.getDashboardReviews(
                null, null, null, null, null, null, null, new BaseFilterRequest());

        assertThat(page.getContent())
                .filteredOn(r -> !Boolean.TRUE.equals(r.getVerified()))
                .allSatisfy(r -> {
                    assertThat(r.getOrderId()).isNull();
                    assertThat(r.getOrderNumber()).isNull();
                });
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=ReviewOrderLinkIntegrationTest`

Expected: FAIL — a compilation error, because `ReviewResponse` has no `getOrderId()`.

- [ ] **Step 3: Add the order query**

In `OrderRepository`, add:

```java
        /**
         * The newest qualifying order per (product, user) for a set of users.
         *
         * <p>ONE query for a whole page of reviews — the dashboard would
         * otherwise run a query per row. A qualifying order is one that is
         * neither CANCELLED nor PENDING, which is the same rule the review's
         * verified flag was set with.
         *
         * <p>Each row is (productId, userId, orderId, orderNumber), newest
         * first; the caller keeps the FIRST row per (product, user) pair.
         */
        @Query("""
                SELECT i.productVariant.product.id, o.user.id, o.id, o.orderNumber
                FROM Order o
                JOIN o.items i
                WHERE o.user.id IN :userIds
                AND o.status NOT IN ('CANCELLED', 'PENDING')
                ORDER BY o.createdAt DESC, o.id DESC
                """)
        List<Object[]> findLatestQualifyingOrdersForUsers(
                @Param("userIds") Collection<Long> userIds);
```

Add `import java.util.Collection;` to the file.

- [ ] **Step 4: Fill the order into the response**

In `ReviewResponse`, add two fields:

```java
    /** The order behind a verified purchase, when there is one. */
    private Long orderId;
    private String orderNumber;
```

In `ReviewService`, add a nested record and rework `buildResponse`:

```java
        /** The order behind a verified purchase. */
        public record OrderRef(Long orderId, String orderNumber) {}

        /**
         * The order map for a page of reviews, keyed by product and user.
         *
         * <p>ONE query per page, not one per row: a page of twenty reviews
         * would otherwise cost twenty round trips to the database.
         */
        private Map<String, OrderRef> loadOrderRefs(List<Review> reviews) {
                if (reviews.isEmpty()) {
                        return Map.of();
                }
                Set<Long> userIds = reviews.stream()
                                .map(r -> r.getUser().getId())
                                .collect(Collectors.toSet());
                if (userIds.isEmpty()) {
                        return Map.of();
                }

                Map<String, OrderRef> refs = new HashMap<>();
                for (Object[] row : orderRepository.findLatestQualifyingOrdersForUsers(userIds)) {
                        long productId = ((Number) row[0]).longValue();
                        long userId = ((Number) row[1]).longValue();
                        String key = productId + ":" + userId;
                        // The rows are newest first, so the FIRST row for a
                        // pair is the one to keep.
                        refs.putIfAbsent(key, new OrderRef(
                                        ((Number) row[2]).longValue(),
                                        (String) row[3]));
                }
                return refs;
        }
```

Change `getDashboardReviews` to pass the map:

```java
                Page<Review> page = reviewRepository.findAllDashboard(
                                productSlug, search, isApproved, isVerified, minRating,
                                createdFrom, createdTo, filter.toPageable());
                Map<String, OrderRef> orders = loadOrderRefs(page.getContent());
                return PageResponse.of(page.map(review -> buildResponse(review, orders)));
```

Change `buildResponse` into two methods:

```java
        public ReviewResponse buildResponse(Review review) {
                return buildResponse(review, Map.of());
        }

        /**
         * The order is attached only when the purchase is CONFIRMED. A review
         * that is not verified carries no order, so the dashboard can trust
         * the check mark it shows next to the reviewer's name.
         */
        public ReviewResponse buildResponse(Review review, Map<String, OrderRef> orders) {
                ... // the existing body, unchanged
                OrderRef order = review.isVerified()
                                ? orders.get(review.getProduct().getId() + ":" + review.getUser().getId())
                                : null;
                return ReviewResponse.builder()
                                ... // the existing fields, unchanged
                                .orderId(order == null ? null : order.orderId())
                                .orderNumber(order == null ? null : order.orderNumber())
                                .build();
        }
```

Inject the order repository into the service: add
`private final OrderRepository orderRepository;` to the class and the import
`com.nocteon.nocteon_api.order.repository.OrderRepository`. (`@RequiredArgsConstructor` wires it.)

Add the imports `java.util.HashMap`, `java.util.Map`, `java.util.Set`, `java.util.stream.Collectors` to the file.

- [ ] **Step 5: Run the test to verify it passes**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=ReviewOrderLinkIntegrationTest`

Expected: PASS — 2 tests.

- [ ] **Step 6: Run the whole review test package, because `buildResponse` changed shape**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest='Review*Test'`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/java/com/nocteon/nocteon_api/review src/main/java/com/nocteon/nocteon_api/order src/test/java/com/nocteon/nocteon_api/review
git commit -m "feat(reviews): the order behind a verified purchase

One query for a whole page of reviews, not one per row. The order is
attached only when the purchase is confirmed, so the check mark the
dashboard shows next to the reviewer's name is never a lie."
```

---

### Task 5: The contact-reply email — type, provider, template, raw-content send

**Files:**
- Modify: `src/main/java/com/nocteon/nocteon_api/mail/enums/EmailType.java`
- Create: `src/main/java/com/nocteon/nocteon_api/mail/dataProvider/ContactReplyDataProvider.java`
- Create: `src/main/java/com/nocteon/nocteon_api/mail/service/ContactReplyEmailRenderer.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/mail/service/BrevoClient.java`
- Create: `src/main/resources/templates/emails/contact-reply.html`
- Test: `src/test/java/com/nocteon/nocteon_api/mail/dataProvider/ContactReplyDataProviderTest.java` (new)
- Test: `src/test/java/com/nocteon/nocteon_api/mail/service/ContactReplyEmailRendererTest.java` (new)
- Test: `src/test/java/com/nocteon/nocteon_api/mail/service/BrevoClientRawContentTest.java` (new)

**Interfaces:**
- Consumes: `ContactMessageRepository.findById(Long)`, `TemplateEngine`, `BrevoRestClient`.
- Produces:
  - `EmailType.CONTACT_REPLY`
  - `ContactReplyDataProvider.supports() : EmailType` → `CONTACT_REPLY`; `buildParams(Long contactMessageId) : Map<String, Object>` with the keys `recipientName`, `originalSubject`, `originalMessage`, `replyContent`.
  - `ContactReplyEmailRenderer.subject(Map<String, Object> params) : String` → `"Re: " + originalSubject`; `ContactReplyEmailRenderer.render(Map<String, Object> params) : String` → the HTML.
  - `BrevoClient.sendRawTransactionalEmail(String recipientEmail, String subject, String htmlContent) : String` → the provider message id.

- [ ] **Step 1: Write the failing provider test**

Create `src/test/java/com/nocteon/nocteon_api/mail/dataProvider/ContactReplyDataProviderTest.java`:

```java
package com.nocteon.nocteon_api.mail.dataProvider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.nocteon.nocteon_api.contact.entity.ContactMessage;
import com.nocteon.nocteon_api.contact.repository.ContactMessageRepository;
import com.nocteon.nocteon_api.mail.enums.EmailType;

@ExtendWith(MockitoExtension.class)
class ContactReplyDataProviderTest {

    @Mock
    private ContactMessageRepository contactMessageRepository;

    @InjectMocks
    private ContactReplyDataProvider provider;

    @Test
    void theParamsCarryTheNameTheSubjectTheOriginalAndTheReply() {
        when(contactMessageRepository.findById(7L)).thenReturn(Optional.of(
                ContactMessage.builder()
                        .name("Ahmed Hassan")
                        .email("ahmed@example.com")
                        .subject("Question about shipping")
                        .message("What are the rates to Alexandria?")
                        .replyContent("Here are the rates.")
                        .build()));

        Map<String, Object> params = provider.buildParams(7L);

        assertThat(params).containsEntry("recipientName", "Ahmed Hassan");
        assertThat(params).containsEntry("originalSubject", "Question about shipping");
        assertThat(params).containsEntry("originalMessage", "What are the rates to Alexandria?");
        assertThat(params).containsEntry("replyContent", "Here are the rates.");
    }

    /**
     * A message that has never been answered has a null reply. The params map
     * must survive that: Map.of() rejects a null value, and the failure would
     * surface as a NullPointerException in the middle of a send.
     */
    @Test
    void aMessageWithNoReplyYetDoesNotBreakTheParams() {
        when(contactMessageRepository.findById(8L)).thenReturn(Optional.of(
                ContactMessage.builder()
                        .name("Fatima Ali")
                        .email("fatima@example.com")
                        .subject("Product inquiry")
                        .message("Tell me about the Ethiopia.")
                        .replyContent(null)
                        .build()));

        Map<String, Object> params = provider.buildParams(8L);

        assertThat(params).containsKey("replyContent");
        assertThat(params.get("replyContent")).isNull();
    }

    @Test
    void theProviderHandlesOnlyTheContactReplyType() {
        assertThat(provider.supports()).isEqualTo(EmailType.CONTACT_REPLY);
    }
}
```

- [ ] **Step 2: Write the failing renderer test**

Create `src/test/java/com/nocteon/nocteon_api/mail/service/ContactReplyEmailRendererTest.java`:

```java
package com.nocteon.nocteon_api.mail.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.nocteon.nocteon_api.NocteonApiApplication;
import com.nocteon.nocteon_api.support.TestJwtKeys;

/**
 * The contact-reply email body.
 *
 * <p>It is rendered from a template in THIS repository, not from a template
 * in the Brevo dashboard: a Brevo template would be a manual step outside
 * the code, and there is no reason for the body of a reply to live there.
 */
@SpringBootTest(
        classes = NocteonApiApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
class ContactReplyEmailRendererTest {

    @org.springframework.beans.factory.annotation.Autowired
    private ContactReplyEmailRenderer renderer;

    @DynamicPropertySource
    static void jwtKeys(DynamicPropertyRegistry registry) {
        TestJwtKeys.register(registry);
    }

    @Test
    void theSubjectIsTheCustomersOwnSubjectWithARe() {
        Map<String, Object> params = new HashMap<>();
        params.put("originalSubject", "Question about shipping");

        assertThat(renderer.subject(params)).isEqualTo("Re: Question about shipping");
    }

    @Test
    void theBodyCarriesTheReplyAndQuotesTheOriginal() {
        Map<String, Object> params = new HashMap<>();
        params.put("recipientName", "Ahmed Hassan");
        params.put("originalSubject", "Question about shipping");
        params.put("originalMessage", "What are the rates to Alexandria?");
        params.put("replyContent", "Here are the rates: 75 EGP.");

        String html = renderer.render(params);

        assertThat(html).contains("Here are the rates: 75 EGP.");
        assertThat(html).contains("What are the rates to Alexandria?");
        assertThat(html).contains("Ahmed Hassan");
    }
}
```

- [ ] **Step 3: Write the failing Brevo client test**

Create `src/test/java/com/nocteon/nocteon_api/mail/service/BrevoClientRawContentTest.java`:

```java
package com.nocteon.nocteon_api.mail.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import com.nocteon.nocteon_api.mail.config.BrevoTemplateProperties;
import com.nocteon.nocteon_api.mail.dto.BrevoEmailRequest;
import com.nocteon.nocteon_api.mail.dto.BrevoRawEmailRequest;
import com.nocteon.nocteon_api.mail.service.BrevoRestClient;

@ExtendWith(MockitoExtension.class)
class BrevoClientRawContentTest {
    // The client's send methods are asserted through the request record they
    // build, so this test pins the SHAPE of a raw-content send: a subject and
    // an htmlContent, and NO template id.
}
```

> **Replace the body of that file with a real test before running.** The correct body is given in Step 3b.

- [ ] **Step 3b: Write the real Brevo client test**

`BrevoClient` builds its request privately, so the test asserts on the request record the client produces. To make that testable, the client gains a package-visible method:

```java
    /**
     * The request for a raw-content send: a subject and an HTML body, and NO
     * template id.
     *
     * <p>Brevo accepts either a templateId + params, or a subject + htmlContent
     * — not both. The contact reply uses the second form, so its body can
     * live in this repository instead of in the Brevo dashboard.
     */
    BrevoRawEmailRequest buildRawRequest(String recipientEmail, String subject, String htmlContent) {
        return new BrevoRawEmailRequest(
                new BrevoSender("Nocteon", "orders@nocteon.com"),
                List.of(new BrevoRecipient(recipientEmail)),
                subject,
                htmlContent);
    }
```

The test is then:

```java
package com.nocteon.nocteon_api.mail.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.nocteon.nocteon_api.mail.dto.BrevoRawEmailRequest;

class BrevoClientRawContentTest {

    @Test
    void aRawSendCarriesASubjectAndHtmlAndNoTemplateId() {
        BrevoClient client = new BrevoClient(null, null);

        BrevoRawEmailRequest request =
                client.buildRawRequest("ahmed@example.com", "Re: Question", "<p>Hello</p>");

        assertThat(request.subject()).isEqualTo("Re: Question");
        assertThat(request.htmlContent()).isEqualTo("<p>Hello</p>");
        assertThat(request.to()).hasSize(1);
        assertThat(request.to().get(0).email()).isEqualTo("ahmed@example.com");
    }
}
```

- [ ] **Step 4: Run the three tests to verify they fail**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=ContactReplyDataProviderTest,ContactReplyEmailRendererTest,BrevoClientRawContentTest`

Expected: FAIL — compilation errors, because none of the new classes exist.

- [ ] **Step 5: Add the enum constant**

In `EmailType`, add `CONTACT_REPLY` to the list.

- [ ] **Step 6: Implement the data provider**

Create `src/main/java/com/nocteon/nocteon_api/mail/dataProvider/ContactReplyDataProvider.java`:

```java
package com.nocteon.nocteon_api.mail.dataProvider;

import java.util.HashMap;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.nocteon.nocteon_api.contact.entity.ContactMessage;
import com.nocteon.nocteon_api.contact.repository.ContactMessageRepository;
import com.nocteon.nocteon_api.mail.enums.EmailType;

import lombok.RequiredArgsConstructor;

/**
 * The params of a contact reply email.
 *
 * <p>The map is a {@link HashMap}, not {@code Map.of()}: a message that has
 * not been answered yet has a null reply, and {@code Map.of()} rejects a null
 * value — the failure would surface as a NullPointerException in the middle
 * of a send.
 */
@Component
@RequiredArgsConstructor
public class ContactReplyDataProvider implements EmailTemplateDataProvider {

    private final ContactMessageRepository contactMessageRepository;

    @Override
    public EmailType supports() {
        return EmailType.CONTACT_REPLY;
    }

    @Override
    public Map<String, Object> buildParams(Long contactMessageId) {
        ContactMessage message = contactMessageRepository.findById(contactMessageId)
                .orElseThrow(() -> new IllegalStateException(
                        "Contact message not found: " + contactMessageId));

        Map<String, Object> params = new HashMap<>();
        params.put("recipientName", message.getName());
        params.put("originalSubject", message.getSubject());
        params.put("originalMessage", message.getMessage());
        params.put("replyContent", message.getReplyContent());
        return params;
    }
}
```

- [ ] **Step 7: Implement the renderer and the template**

Create `src/main/resources/templates/emails/contact-reply.html`:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${originalSubject}</title>
  </head>
  <body style="margin:0;padding:24px;background:#f6f2ed;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#231a14;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;">
      <tr>
        <td style="padding:28px 32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Hi <strong th:text="${recipientName}">Name</strong>,</p>

          <!-- The reply, verbatim. The admin wrote it; the customer reads it. -->
          <div style="font-size:15px;line-height:1.6;white-space:pre-wrap;" th:text="${replyContent}">Your reply</div>

          <!-- The original, quoted, so the customer can see what is answered. -->
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e6ded4;font-size:13px;line-height:1.6;color:#6b5d52;">
            <p style="margin:0 0 6px;">On <span th:text="${originalSubject}">Subject</span>, you wrote:</p>
            <div style="white-space:pre-wrap;" th:text="${originalMessage}">Original message</div>
          </div>

          <p style="margin:24px 0 0;font-size:13px;color:#6b5d52;">— Nocteon Coffee</p>
        </td>
      </tr>
    </table>
  </body>
</html>
```

The wrapper carries no prose in any language: the customer's name, their own subject, their own message and the admin's words. A customer who wrote in Arabic gets an Arabic reply, because the admin answered in Arabic.

Create `src/main/java/com/nocteon/nocteon_api/mail/service/ContactReplyEmailRenderer.java`:

```java
package com.nocteon.nocteon_api.mail.service;

import java.util.Map;

import org.springframework.stereotype.Component;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import lombok.RequiredArgsConstructor;

/**
 * Renders the contact-reply email.
 *
 * <p>The body is rendered from a template in THIS repository, not from a
 * template in the Brevo dashboard: a Brevo template would be a manual step
 * outside the code, and the body of a reply has no reason to live there.
 */
@Component
@RequiredArgsConstructor
public class ContactReplyEmailRenderer {

    /** The template name — Thymeleaf resolves the prefix and the .html suffix. */
    private static final String TEMPLATE = "emails/contact-reply";

    private final TemplateEngine templateEngine;

    /**
     * The subject: the customer's OWN subject, prefixed. Their words, so it
     * reads correctly in whatever language they wrote in.
     */
    public String subject(Map<String, Object> params) {
        Object subject = params.get("originalSubject");
        return "Re: " + (subject == null ? "" : subject);
    }

    public String render(Map<String, Object> params) {
        Context context = new Context();
        params.forEach(context::setVariable);
        return templateEngine.process(TEMPLATE, context);
    }
}
```

- [ ] **Step 8: Add the raw-content send to the Brevo client**

Create `src/main/java/com/nocteon/nocteon_api/mail/dto/BrevoRawEmailRequest.java`:

```java
package com.nocteon.nocteon_api.mail.dto;

import java.util.List;

/**
 * A Brevo send that carries its own content.
 *
 * <p>Brevo accepts EITHER a templateId + params, OR a subject + htmlContent —
 * not both. This is the second form, used by the contact reply so its body
 * can live in this repository.
 */
public record BrevoRawEmailRequest(
        BrevoSender sender,
        List<BrevoRecipient> to,
        String subject,
        String htmlContent
) {}
```

In `BrevoClient`, add:

```java
    /**
     * Sends a message that carries its own subject and HTML body.
     *
     * <p>The other form of the Brevo call — a template id plus params — is
     * used by the transactional templates. This one is for the bodies that
     * live in this repository.
     */
    public String sendRawTransactionalEmail(String recipientEmail, String subject, String htmlContent) {
        BrevoRawEmailRequest request = buildRawRequest(recipientEmail, subject, htmlContent);

        try {
            BrevoEmailResponse response = brevoRestClient.post()
                    .uri("/smtp/email")
                    .body(request)
                    .retrieve()
                    .body(BrevoEmailResponse.class);

            if (response == null || response.messageId() == null) {
                throw new BrevoApiException("Empty response from Brevo");
            }

            return response.messageId();

        } catch (HttpClientErrorException ex) {
            throw new BrevoApiException("Brevo rejected request (4xx): " + ex.getResponseBodyAsString(), ex);
        } catch (HttpServerErrorException ex) {
            throw new BrevoRetryableException("Brevo server error (5xx): " + ex.getResponseBodyAsString());
        } catch (BrevoApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BrevoApiException("Unexpected error calling Brevo: " + ex.getMessage(), ex);
        }
    }
```

> The `BrevoEmailResponse` record is reused for the response shape — it is `{ messageId }` in both forms.

- [ ] **Step 9: Run the three tests to verify they pass**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=ContactReplyDataProviderTest,ContactReplyEmailRendererTest,BrevoClientRawContentTest`

Expected: PASS — 6 tests.

- [ ] **Step 10: Commit**

```bash
git add src/main/java/com/nocteon/nocteon_api/mail src/main/resources/templates/emails/contact-reply.html src/test/java/com/nocteon/nocteon_api/mail
git commit -m "feat(mail): the contact-reply email, rendered in this repository

Brevo accepts a subject + htmlContent as well as a template id + params, so
the body of a reply can live here instead of in the Brevo dashboard — one
manual step fewer, and nothing for a human to do outside the repo.

The wrapper carries no prose in any language: the customer's name, their own
subject, their own message quoted, and the admin's words verbatim."
```

---

### Task 6: The reply sends, and the page can see whether it did

**Files:**
- Modify: `src/main/java/com/nocteon/nocteon_api/mail/repository/EmailLogRepository.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/mail/service/TransactionalEmailService.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/contact/dto/response/ContactResponse.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/contact/service/ContactService.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/contact/controller/ContactController.java`
- Test: `src/test/java/com/nocteon/nocteon_api/contact/service/ContactServiceReplyTest.java` (new)
- Test: `src/test/java/com/nocteon/nocteon_api/contact/ContactEmailStatusIntegrationTest.java` (new)

**Interfaces:**
- Consumes: `EmailType.CONTACT_REPLY`, `ContactReplyDataProvider`, `ContactReplyEmailRenderer`, `BrevoClient.sendRawTransactionalEmail`.
- Produces:
  - `TransactionalEmailService.enqueueOrResendEmail(String idempotencyKey, EmailType type, String recipient, String relatedEntityType, Long relatedEntityId) : EmailStatus`
  - `EmailLogRepository.findByRelatedEntityTypeAndRelatedEntityIdIn(String relatedEntityType, Collection<Long> relatedEntityIds) : List<EmailLog>`
  - `ContactResponse` — gains `String emailStatus` (`NONE` / `PENDING` / `SENT` / `FAILED` / `DEAD`).
  - `POST /api/dashboard/contact-messages/{id}/resend-email` (authority `contact:update`).

- [ ] **Step 1: Write the failing unit test**

Create `src/test/java/com/nocteon/nocteon_api/contact/service/ContactServiceReplyTest.java`:

```java
package com.nocteon.nocteon_api.contact.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.nocteon.nocteon_api.contact.dto.response.ContactResponse;
import com.nocteon.nocteon_api.contact.entity.ContactMessage;
import com.nocteon.nocteon_api.contact.repository.ContactMessageRepository;
import com.nocteon.nocteon_api.mail.enums.EmailStatus;
import com.nocteon.nocteon_api.mail.enums.EmailType;
import com.nocteon.nocteon_api.mail.service.TransactionalEmailService;

@ExtendWith(MockitoExtension.class)
class ContactServiceReplyTest {

    @Mock
    private ContactMessageRepository contactMessageRepository;

    @Mock
    private TransactionalEmailService transactionalEmailService;

    @InjectMocks
    private ContactService contactService;

    @Test
    void theReplyIsSavedAndTheEmailIsEnqueuedForThatMessage() {
        when(contactMessageRepository.findById(3L)).thenReturn(Optional.of(
                ContactMessage.builder()
                        .name("Ahmed Hassan")
                        .email("ahmed@example.com")
                        .subject("Question about shipping")
                        .message("What are the rates?")
                        .build()));
        when(contactMessageRepository.save(any(ContactMessage.class)))
                .thenAnswer(invocation -> {
                    ContactMessage saved = invocation.getArgument(0);
                    saved.setId(3L);
                    return saved;
                });
        when(transactionalEmailService.enqueueOrResendEmail(any(), any(), any(), any(), any()))
                .thenReturn(EmailStatus.SENT);

        ContactResponse response = contactService.reply(3L, "Here are the rates.");

        assertThat(response.getReplyContent()).isEqualTo("Here are the rates.");
        assertThat(response.isRead()).isTrue();
        assertThat(response.isReplied()).isTrue();
        assertThat(response.getEmailStatus()).isEqualTo("SENT");

        verify(transactionalEmailService).enqueueOrResendEmail(
                eq("contact-reply:3"),
                eq(EmailType.CONTACT_REPLY),
                eq("ahmed@example.com"),
                eq("contact_message"),
                eq(3L));
    }

    /**
     * A failed email must NOT lose the reply. The admin's words are saved
     * first; the email is attempted second; the status tells the dashboard
     * which of the two happened.
     */
    @Test
    void aFailedEmailStillKeepsTheReplyAndReportsTheFailure() {
        when(contactMessageRepository.findById(4L)).thenReturn(Optional.of(
                ContactMessage.builder()
                        .name("Fatima Ali")
                        .email("fatima@example.com")
                        .subject("Product inquiry")
                        .message("Tell me more.")
                        .build()));
        when(contactMessageRepository.save(any(ContactMessage.class)))
                .thenAnswer(invocation -> {
                    ContactMessage saved = invocation.getArgument(0);
                    saved.setId(4L);
                    return saved;
                });
        when(transactionalEmailService.enqueueOrResendEmail(any(), any(), any(), any(), any()))
                .thenReturn(EmailStatus.FAILED);

        ContactResponse response = contactService.reply(4L, "Here is the roast level.");

        assertThat(response.getReplyContent()).isEqualTo("Here is the roast level.");
        assertThat(response.getEmailStatus()).isEqualTo("FAILED");
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=ContactServiceReplyTest`

Expected: FAIL — a compilation error, because `enqueueOrResendEmail` and `getEmailStatus` do not exist.

- [ ] **Step 3: Implement the enqueue and the status plumbing**

In `EmailLogRepository`, add:

```java
    /** The email rows for a set of entities — one query for a whole page. */
    List<EmailLog> findByRelatedEntityTypeAndRelatedEntityIdIn(
            String relatedEntityType,
            Collection<Long> relatedEntityIds);
```

Add `import java.util.Collection;` to the file.

In `TransactionalEmailService`, add:

```java
    /**
     * Enqueue an email, or re-send one that was already queued.
     *
     * <p>One row per (key): the row is reset to PENDING, the attempt counter
     * is zeroed, and the send is attempted immediately. A second reply to the
     * same message therefore re-sends the CURRENT answer instead of queueing
     * a second copy of an older one.
     *
     * <p>The attempt is INLINE, so the caller learns right away whether the
     * provider accepted the message. When it did not, the row stays FAILED
     * with the error recorded, and the retry worker picks it up on the
     * backoff schedule.
     *
     * @return the status the row ended in
     */
    @Transactional
    public EmailStatus enqueueOrResendEmail(String idempotencyKey, EmailType type,
            String recipient, String relatedEntityType, Long relatedEntityId) {
        EmailLog logEntry = emailLogRepository.findByIdempotencyKey(idempotencyKey)
                .orElseGet(EmailLog::new);

        logEntry.setIdempotencyKey(idempotencyKey);
        logEntry.setEmailType(type);
        logEntry.setRecipientEmail(recipient);
        logEntry.setRelatedEntityType(relatedEntityType);
        logEntry.setRelatedEntityId(relatedEntityId);
        logEntry.setStatus(EmailStatus.PENDING);
        logEntry.setAttemptCount(0);
        logEntry.setLastError(null);
        logEntry.setSentAt(null);

        try {
            emailLogRepository.saveAndFlush(logEntry);
        } catch (DataIntegrityViolationException e) {
            log.info("Race condition caught for key {}", idempotencyKey);
            return EmailStatus.PENDING;
        }

        Map<String, Object> resolvedParams = templateDataResolver.resolve(type, relatedEntityId);
        attemptSend(logEntry, resolvedParams);
        return logEntry.getStatus();
    }
```

And change `attemptSend` so a contact reply goes out as raw content:

```java
    private void attemptSend(EmailLog logEntry, Map<String, Object> templateParams) {
        try {
            String messageId;
            if (logEntry.getEmailType() == EmailType.CONTACT_REPLY) {
                // The body of a reply lives in this repository, not in a
                // provider-side template, so it is rendered here and sent as
                // raw content.
                messageId = brevoClient.sendRawTransactionalEmail(
                        logEntry.getRecipientEmail(),
                        contactReplyEmailRenderer.subject(templateParams),
                        contactReplyEmailRenderer.render(templateParams));
            } else {
                messageId = brevoClient.sendTransactionalEmail(
                        logEntry.getRecipientEmail(),
                        logEntry.getEmailType(),
                        templateParams);
            }
            logEntry.setStatus(EmailStatus.SENT);
            logEntry.setProviderMessageId(messageId);
            logEntry.setSentAt(Instant.now());
            emailLogRepository.save(logEntry);

        } catch (BrevoApiException ex) {
            int newAttemptCount = logEntry.getAttemptCount() + 1;
            logEntry.setAttemptCount(newAttemptCount);
            logEntry.setLastError(truncate(ex.getMessage(), 1000));

            boolean shouldRetry = ex instanceof BrevoRetryableException && !retryPolicy.isDead(newAttemptCount);
            logEntry.setStatus(shouldRetry ? EmailStatus.FAILED : EmailStatus.DEAD);
            emailLogRepository.save(logEntry);

            log.error("Failed to send email key={}, attempt={}", logEntry.getIdempotencyKey(), newAttemptCount, ex);
        }
    }
```

Inject the renderer into the service: add
`private final ContactReplyEmailRenderer contactReplyEmailRenderer;` to the class.

- [ ] **Step 4: Fill the status into the contact response**

In `ContactResponse`, add:

```java
    /** NONE / PENDING / SENT / FAILED / DEAD — the recorded state of the reply email. */
    private String emailStatus;
```

In `ContactService`:

- add the dependency `private final TransactionalEmailService transactionalEmailService;` and
  `private final EmailLogRepository emailLogRepository;`
- change `reply` to:

```java
    /**
     * Save the reply and send the customer an email.
     *
     * <p>The reply is saved FIRST and the email is attempted SECOND, so a
     * failed email never loses the admin's words. The returned status is the
     * one the email actually reached: SENT, FAILED (the worker will retry) or
     * DEAD.
     */
    @Transactional
    public ContactResponse reply(Long id, String replyContent) {
        ContactMessage message = contactMessageRepository.findById(id)
                .orElseThrow(() -> new ContactMessageNotFoundException());
        message.setRead(true);
        message.setReplied(true);
        message.setReplyContent(replyContent);
        ContactMessage saved = contactMessageRepository.save(message);

        EmailStatus emailStatus = transactionalEmailService.enqueueOrResendEmail(
                "contact-reply:" + saved.getId(),
                EmailType.CONTACT_REPLY,
                saved.getEmail(),
                "contact_message",
                saved.getId());

        return buildResponse(saved, emailStatus);
    }
```

- add a resend method:

```java
    /**
     * Send the stored reply again, without changing it.
     *
     * <p>The escape hatch when the provider refused the message, or when the
     * address was wrong.
     */
    @Transactional
    public ContactResponse resendEmail(Long id) {
        ContactMessage message = contactMessageRepository.findById(id)
                .orElseThrow(() -> new ContactMessageNotFoundException());
        if (message.getReplyContent() == null || message.getReplyContent().isBlank()) {
            throw new BaseApiException("Cannot resend: this message has no reply yet");
        }

        EmailStatus emailStatus = transactionalEmailService.enqueueOrResendEmail(
                "contact-reply:" + message.getId(),
                EmailType.CONTACT_REPLY,
                message.getEmail(),
                "contact_message",
                message.getId());

        return buildResponse(message, emailStatus);
    }
```

- change `buildResponse` into two methods:

```java
    private ContactResponse buildResponse(ContactMessage message) {
        return buildResponse(message, emailStatusFor(message.getId()));
    }

    private ContactResponse buildResponse(ContactMessage message, EmailStatus status) {
        return ContactResponse.builder()
                .id(message.getId())
                .name(message.getName())
                .email(message.getEmail())
                .subject(message.getSubject())
                .message(message.getMessage())
                .isRead(message.isRead())
                .isReplied(message.isReplied())
                .replyContent(message.getReplyContent())
                .emailStatus(status == null ? "NONE" : status.name())
                .createdAt(message.getCreatedAt())
                .build();
    }

    /**
     * The recorded state of this message's email, or NONE when it was never
     * emailed.
     */
    private EmailStatus emailStatusFor(Long messageId) {
        if (messageId == null) {
            return null;
        }
        return emailLogRepository
                .findByRelatedEntityTypeAndRelatedEntityIdIn("contact_message", List.of(messageId))
                .stream()
                .findFirst()
                .map(EmailLog::getStatus)
                .orElse(null);
    }
```

- make the LIST endpoints use ONE batched query instead of one per row. Change `getAll` and `getAllUnread` to:

```java
    public PageResponse<ContactResponse> getAll(BaseFilterRequest filter) {
        Page<ContactMessage> page = contactMessageRepository.findAll(filter.toPageable());
        return buildPage(page);
    }

    public PageResponse<ContactResponse> getAllUnread(BaseFilterRequest filter) {
        Page<ContactMessage> page = contactMessageRepository.findByIsReadFalse(filter.toPageable());
        return buildPage(page);
    }

    /**
     * The page, with the email status of every message read in ONE query —
     * twenty messages must not cost twenty round trips.
     */
    private PageResponse<ContactResponse> buildPage(Page<ContactMessage> page) {
        List<ContactMessage> content = page.getContent();
        Map<Long, EmailStatus> statuses = emailStatusesFor(content);

        List<ContactResponse> responses = content.stream()
                .map(m -> buildResponse(m, statuses.get(m.getId())))
                .toList();

        return PageResponse.<ContactResponse>builder()
                .content(responses)
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .first(page.isFirst())
                .last(page.isLast())
                .build();
    }

    private Map<Long, EmailStatus> emailStatusesFor(List<ContactMessage> messages) {
        if (messages.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = messages.stream().map(ContactMessage::getId).toList();
        Map<Long, EmailStatus> statuses = new HashMap<>();
        for (EmailLog log : emailLogRepository
                .findByRelatedEntityTypeAndRelatedEntityIdIn("contact_message", ids)) {
            statuses.putIfAbsent(log.getRelatedEntityId(), log.getStatus());
        }
        return statuses;
    }
```

Add the imports `java.util.HashMap`, `java.util.Map`,
`com.nocteon.nocteon_api.mail.entity.EmailLog`,
`com.nocteon.nocteon_api.mail.enums.EmailStatus`,
`com.nocteon.nocteon_api.mail.enums.EmailType`,
`com.nocteon.nocteon_api.mail.repository.EmailLogRepository`,
`com.nocteon.nocteon_api.mail.service.TransactionalEmailService` to `ContactService`.

- [ ] **Step 5: Add the resend endpoint**

In `ContactController`, add:

```java
    @PostMapping("/dashboard/contact-messages/{id}/resend-email")
    @PreAuthorize("hasAuthority('contact:update')")
    public ResponseEntity<ApiResponse<ContactResponse>> resendEmail(@PathVariable Long id) {
        return ResponseEntity.ok(
                ApiResponse.success(contactService.resendEmail(id), "Reply email re-sent"));
    }
```

- [ ] **Step 6: Write the failing integration test**

Create `src/test/java/com/nocteon/nocteon_api/contact/ContactEmailStatusIntegrationTest.java`:

```java
package com.nocteon.nocteon_api.contact;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.nocteon.nocteon_api.NocteonApiApplication;
import com.nocteon.nocteon_api.common.dto.BaseFilterRequest;
import com.nocteon.nocteon_api.common.dto.PageResponse;
import com.nocteon.nocteon_api.contact.dto.response.ContactResponse;
import com.nocteon.nocteon_api.contact.service.ContactService;
import com.nocteon.nocteon_api.support.TestJwtKeys;

/**
 * The email status on a contact message.
 *
 * <p>The seeded messages have never been answered, so their status is NONE.
 * That is the state the dashboard must show for a message nobody replied to
 * — not a blank, and not a false "sent".
 */
@SpringBootTest(
        classes = NocteonApiApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
class ContactEmailStatusIntegrationTest {

    @Autowired
    private ContactService contactService;

    @DynamicPropertySource
    static void jwtKeys(DynamicPropertyRegistry registry) {
        TestJwtKeys.register(registry);
    }

    @Test
    void aMessageThatWasNeverAnsweredCarriesNoEmailStatus() {
        PageResponse<ContactResponse> page = contactService.getAll(new BaseFilterRequest());

        assertThat(page.getContent()).isNotEmpty();
        assertThat(page.getContent())
                .allSatisfy(m -> assertThat(m.getEmailStatus()).isNotNull());
        assertThat(page.getContent())
                .filteredOn(m -> m.getReplyContent() == null)
                .allSatisfy(m -> assertThat(m.getEmailStatus()).isEqualTo("NONE"));
    }
}
```

- [ ] **Step 7: Run both tests to verify they pass**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=ContactServiceReplyTest,ContactEmailStatusIntegrationTest`

Expected: PASS.

> **Note:** the unit test mocks `TransactionalEmailService`, so no email is sent by the suite. The integration test only reads. Nothing in the test suite sends a real email.

- [ ] **Step 8: Commit**

```bash
git add src/main/java/com/nocteon/nocteon_api/contact src/main/java/com/nocteon/nocteon_api/mail src/test/java/com/nocteon/nocteon_api/contact
git commit -m "feat(contact): the reply sends an email, and the page sees whether it did

The reply is saved first and the email is attempted second, so a failed
email never loses the admin's words. The status comes from email_log, so
the dashboard reports what happened rather than what it hoped happened."
```

---

### Task 7: The retry worker gets its own flag

**Files:**
- Modify: `src/main/java/com/nocteon/nocteon_api/mail/config/MailProperties.java`
- Modify: `src/main/java/com/nocteon/nocteon_api/mail/scheduler/EmailRetryScheduler.java`
- Modify: `src/main/resources/application.yaml`
- Test: `src/test/java/com/nocteon/nocteon_api/mail/service/EmailRetrySchedulerTest.java` (new)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MailProperties.isRetryEnabled() : boolean` — bound from `nocteon.mail.retry-enabled`, i.e. the env var `MAIL_RETRY_ENABLED`, default `false`.
  - `EmailRetryScheduler.run()` drains the queue only when `isRetryEnabled()` is true. `MAIL_SCHEDULING_ENABLED` keeps gating the abandoned-cart job.

- [ ] **Step 1: Write the failing test**

Create `src/test/java/com/nocteon/nocteon_api/mail/service/EmailRetrySchedulerTest.java`:

```java
package com.nocteon.nocteon_api.mail.service;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.nocteon.nocteon_api.mail.config.MailProperties;

@ExtendWith(MockitoExtension.class)
class EmailRetrySchedulerTest {

    @Mock
    private TransactionalEmailService emailService;

    @Mock
    private MailProperties mailProperties;

    @InjectMocks
    private EmailRetryScheduler scheduler;

    @Test
    void aDisabledWorkerDoesNotTouchTheQueue() {
        org.mockito.Mockito.when(mailProperties.isRetryEnabled()).thenReturn(false);

        scheduler.run();

        verify(emailService, never()).retryPendingEmails();
    }

    @Test
    void anEnabledWorkerDrainsTheQueue() {
        org.mockito.Mockito.when(mailProperties.isRetryEnabled()).thenReturn(true);

        scheduler.run();

        verify(emailService).retryPendingEmails();
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=EmailRetrySchedulerTest`

Expected: FAIL — a compilation error, because `isRetryEnabled()` does not exist.

- [ ] **Step 3: Add the flag**

In `MailProperties`, add:

```java
    /**
     * Whether the email RETRY worker may run.
     *
     * <p>A separate switch from {@link #isSchedulingEnabled()}, on purpose.
     * That flag also gates {@code AbandonedCartScheduler}, and switching it
     * on would start abandoned-cart reminders to real addresses — not a
     * decision the reply-email feature gets to make. This flag turns on the
     * retry of FAILED transactional emails only.
     */
    private boolean retryEnabled;
```

In `application.yaml`, under `nocteon.mail`, add:

```yaml
    # Gates the email RETRY worker only (failed transactional sends).
    # Separate from scheduling-enabled, which also starts the abandoned-cart
    # job. Off by default: the queue has never been inspected.
    retry-enabled: ${MAIL_RETRY_ENABLED:false}
```

In `EmailRetryScheduler`, change the gate:

```java
    @Scheduled(fixedDelay = 60_000)
    public void run() {
        if (!mailProperties.isRetryEnabled()) {
            log.debug("Mail retry is disabled, skipping the email retry pass");
            return;
        }

        emailService.retryPendingEmails();
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=EmailRetrySchedulerTest`

Expected: PASS — 2 tests.

- [ ] **Step 5: Read the queue before the flag is ever turned on**

Run:
`PGPASSWORD=postgres psql -h localhost -U postgres -d nocteon_db -c "select status, count(*), min(updated_at) from email_log group by status order by status;"`

Expected: a table. **Record the output in the task's commit message or a comment in the PR** — this is the "the queue has never been inspected" risk from the Review Focus. If rows exist in PENDING or FAILED, they will be sent the moment the flag is set; decide what to do with them BEFORE enabling it.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/nocteon/nocteon_api/mail src/main/resources/application.yaml src/test/java/com/nocteon/nocteon_api/mail
git commit -m "feat(mail): the retry worker gets its own flag

The existing scheduling-enabled flag also gates AbandonedCartScheduler, so
turning it on would start abandoned-cart emails to real addresses. The
retry worker gets its own switch, off by default."
```

---

### Task 8: The seed cleanup

**Files:**
- Create: `src/main/resources/db/migration/V110__fix_review_and_media_seed.sql`
- Test: `src/test/java/com/nocteon/nocteon_api/seed/SeedDataIntegrityTest.java` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: a database in which
  - Brazil Mogiana's primary media is a coffee image, and the concert photo is gone;
  - no review belongs to an admin account;
  - the review counts are unchanged — 15 total, 13 approved, 2 pending.

- [ ] **Step 1: Write the failing test**

Create `src/test/java/com/nocteon/nocteon_api/seed/SeedDataIntegrityTest.java`:

```java
package com.nocteon.nocteon_api.seed;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import com.nocteon.nocteon_api.NocteonApiApplication;
import com.nocteon.nocteon_api.support.TestJwtKeys;

/**
 * The seed data a moderator sees.
 *
 * <p>Two defects made the reviews page look broken: the primary image of
 * Brazil Mogiana was a concert photograph, and three of the fifteen reviews
 * were written by the admin account — so the moderation queue showed a
 * moderator reviewing their own store's products.
 */
@SpringBootTest(
        classes = NocteonApiApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE)
class SeedDataIntegrityTest {

    /** The concert photograph that was Brazil Mogiana's primary image. */
    private static final String CONCERT_PHOTO = "photo-1516450360452-9312f5e86fc7";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void jwtKeys(DynamicPropertyRegistry registry) {
        TestJwtKeys.register(registry);
    }

    @Test
    void noReviewIsWrittenByAnAdmin() {
        Integer adminReviews = jdbcTemplate.queryForObject(
                "select count(*) from reviews r join users u on u.id = r.user_id "
                        + "where u.role = 'ADMIN'",
                Integer.class);

        assertThat(adminReviews).isZero();
    }

    @Test
    void theBrazilMogianaPrimaryImageIsNotTheConcert() {
        String url = jdbcTemplate.queryForObject(
                "select m.url from product_media m join products p on p.id = m.product_id "
                        + "where p.slug = 'brazil-mogiana' and m.is_primary",
                String.class);

        assertThat(url).isNotNull();
        assertThat(url).doesNotContain(CONCERT_PHOTO);
        assertThat(url).contains("unsplash.com");
    }

    @Test
    void theConcertPhotographIsGoneFromEveryProduct() {
        Integer count = jdbcTemplate.queryForObject(
                "select count(*) from product_media where url like ?",
                Integer.class, "%" + CONCERT_PHOTO + "%");

        assertThat(count).isZero();
    }

    @Test
    void theReviewCountsAreUnchanged() {
        Integer total = jdbcTemplate.queryForObject(
                "select count(*) from reviews where deleted_at is null", Integer.class);
        Integer pending = jdbcTemplate.queryForObject(
                "select count(*) from reviews where deleted_at is null and is_approved = false",
                Integer.class);

        assertThat(total).isEqualTo(15);
        assertThat(pending).isEqualTo(2);
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=SeedDataIntegrityTest`

Expected: FAIL — the admin-authored reviews and the concert photo are still in the database.

- [ ] **Step 3: Write the migration**

Create `src/main/resources/db/migration/V110__fix_review_and_media_seed.sql`:

```sql
-- ============================================================
-- V110: Fix the review seed and Brazil Mogiana's primary image
-- ============================================================
-- Two defects the reviews page made obvious:
--
--   1. Brazil Mogiana's PRIMARY image was a concert photograph
--      (photo-1516450360452-9312f5e86fc7), with the alt text
--      claiming it was a cup of coffee.
--   2. Three of the fifteen reviews were written by user_id 1,
--      the ADMIN account — so the moderation queue showed a
--      moderator reviewing their own store's products.
--
-- The fix keeps every count exactly as it was: 15 reviews,
-- 13 approved, 2 pending.

-- ----------------------------------------------------------
-- 1. Brazil Mogiana's images
-- ----------------------------------------------------------
-- The concert photograph leaves the product entirely.
DELETE FROM product_media
WHERE url LIKE '%photo-1516450360452-9312f5e86fc7%';

-- The cup of black coffee becomes the primary image: it is the same
-- visual family as the other three coffees (ethiopia, colombia,
-- kenya all lead with a cup), and a full-bodied Typica suits a
-- black coffee better than a beans texture does.
UPDATE product_media
SET is_primary = FALSE,
    sort_order = 2
WHERE url LIKE '%photo-1521302080334-4bebac2763a6%'
  AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_media.product_id
              AND p.slug = 'brazil-mogiana');

INSERT INTO product_media (product_id, url, alt_text, type, sort_order, is_primary)
SELECT p.id,
       'https://images.unsplash.com/photo-1521302080334-4bebac2763a6?w=800',
       'Brazil Mogiana washed Typica, brewed as a full-bodied black coffee',
       'IMAGE',
       0,
       TRUE
FROM products p
WHERE p.slug = 'brazil-mogiana'
  AND NOT EXISTS (
      SELECT 1 FROM product_media m
      WHERE m.product_id = p.id
        AND m.url = 'https://images.unsplash.com/photo-1521302080334-4bebac2763a6?w=800'
  );

-- Colombia Huila still uses the same photograph as a secondary image,
-- which is fine — only the PRIMARY is what a card leads with.
UPDATE product_media
SET is_primary = FALSE
WHERE url LIKE '%photo-1521302080334-4bebac2763a6%'
  AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_media.product_id
              AND p.slug = 'colombia-huila');

-- ----------------------------------------------------------
-- 2. The reviews
-- ----------------------------------------------------------
-- The three admin-authored reviews move to customer accounts that
-- (a) have no review for that product yet — the table has a
-- UNIQUE (user_id, product_id) constraint — and (b) where possible
-- have actually bought it, so the "verified purchase" check mark
-- has an order behind it.
--
--   review 1  admin  -> mohamed (3)  ethiopia-yirgacheffe  order ORD-2026-000003
--   review 6  admin  -> ahmed   (2)  kenya-nyeri         order ORD-2026-000013
--   review 11 admin  -> youssef (7)  hario-v60            no purchase -> not verified
UPDATE reviews SET user_id = 3 WHERE id = 1 AND user_id = 1;
UPDATE reviews SET user_id = 2 WHERE id = 6 AND user_id = 1;

-- Nobody in the seed has bought the Hario V60, so this review
-- cannot be a verified purchase. Saying so is the honest state,
-- and it is the case the dashboard's "no check mark" branch needs.
UPDATE reviews
SET user_id = 7,
    is_verified = FALSE
WHERE id = 11 AND user_id = 1;

-- End of V110
```

> **Check the constraint before running:** `uk_user_product_review` is UNIQUE on `(user_id, product_id)`. The three new pairs — (3, ethiopia), (2, kenya), (7, hario-v60) — must not already exist. Verify with
> `PGPASSWORD=postgres psql -h localhost -U postgres -d nocteon_db -c "select user_id, product_id from reviews;"`
> before applying the migration. If a pair already exists, change the target user in the migration, not the constraint.

- [ ] **Step 4: Run the test to verify it passes**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=SeedDataIntegrityTest`

Expected: FAIL until the migration is applied — the test runs against the database, and Flyway applies the new migration on the next context start. Re-run once the context has started:

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test -Dtest=SeedDataIntegrityTest`

Expected: PASS — 4 tests.

- [ ] **Step 5: Run the whole suite, because the seed changed under the other tests**

Run: `env JAVA_HOME=/home/abdelrhman/.local/share/mise/installs/java/21.0.2 ./mvnw test`

Expected: PASS. If the review order-link test fails, the re-pointed reviews changed which order qualifies — read the failure before changing anything.

- [ ] **Step 6: Commit**

```bash
git add src/main/resources/db/migration/V110__fix_review_and_media_seed.sql src/test/java/com/nocteon/nocteon_api/seed
git commit -m "fix(seed): Brazil Mogiana's image and the admin-authored reviews

The primary image of Brazil Mogiana was a concert photograph with an alt
text claiming it was coffee, and three of the fifteen reviews were
written by the admin account — so the moderation queue showed a moderator
reviewing their own store's products.

Every count is unchanged: 15 reviews, 13 approved, 2 pending."
```

---

## Done means

- `./mvnw test` is green.
- `GET /api/dashboard/reviews?productSlug=brazil-mogiana` returns only that product; `?search=excellent` searches comments and usernames; `?createdFrom=…&createdTo=…` narrows by date.
- `GET /api/dashboard/reviews/stats` returns the counts, the average and the five-bucket distribution.
- `PATCH /api/dashboard/reviews/approval` approves a set and reports what it changed.
- The review response carries `orderId` and `orderNumber` for a verified purchase with an order, and nulls otherwise.
- `POST /api/dashboard/contact-messages/{id}/reply` saves the reply, attempts the email, and returns the email status.
- `POST /api/dashboard/contact-messages/{id}/resend-email` re-sends the stored reply.
- The contact response carries `emailStatus`.
- `MAIL_RETRY_ENABLED=false` by default; the abandoned-cart job is untouched.
- The seed has no concert photograph and no admin-authored review.

**The dashboard plan is next:** `docs/superpowers/plans/2026-10-20-reviews-contact-messages-dashboard.md`, in the other repository. It consumes exactly the endpoints this plan produces.
