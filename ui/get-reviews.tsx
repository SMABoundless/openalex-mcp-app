import { render } from "preact";
import type { GetReviewsOutput, ReviewOutput } from "../server/output-types";
import { AppShell } from "./shared/components/AppShell";
import { formatAuthors, formatNumber, shortId } from "./shared/utils/format";
import "./shared/styles/base.css";
import "./shared/styles/components.css";

const SOURCE: Record<NonNullable<ReviewOutput["text_source"]>, string> = {
  elife: "Text from eLife",
  review_commons: "Text from Review Commons",
  openalex_stored: "Text from OpenAlex",
};

function ReviewCard({ review }: { review: ReviewOutput }) {
  const work = review.work;
  return (
    <div class="card">
      <div class="card-title">
        {review.link ? (
          <a href={review.link} target="_blank" rel="noopener noreferrer">{work.title}</a>
        ) : (
          work.title
        )}
      </div>
      <div class="card-meta">
        {work.authors.length > 0 && <>{formatAuthors(work)} &middot; </>}
        {work.publication_date ?? work.publication_year ?? "undated"}
        {work.source && <> &middot; {work.source.name}</>}
        <> &middot; {shortId(work.id)}</>
      </div>
      {review.text && review.text_source && (
        <details class="review-text">
          <summary>
            {SOURCE[review.text_source]}
            {review.text_truncated && " (shortened)"}
          </summary>
          <div class="review-body">{review.text}</div>
        </details>
      )}
      {review.note && <div class="card-meta card-footnote">{review.note}</div>}
    </div>
  );
}

function Reviews({ data }: { data: GetReviewsOutput }) {
  const total = data.reviewed_work.total_reviews;
  return (
    <div class="results-container">
      <header class="results-header">
        <h2>Open peer reviews of: {data.reviewed_work.title}</h2>
        <p class="results-subtitle">
          {total === 0
            ? "No published reviews are linked to this work in OpenAlex."
            : `${formatNumber(total)} linked in OpenAlex · ${data.reviews.length} shown, oldest first`}
        </p>
      </header>
      {data.reviews.map((r) => <ReviewCard key={r.work.id} review={r} />)}
      {data.paid_downloads > 0 && (
        <p class="muted table-note">
          Paid downloads of stored text in this request: {data.paid_downloads} (${(data.paid_downloads * 0.01).toFixed(2)}).
        </p>
      )}
      <p class="muted table-note">
        Only published reviews appear here. A work with none may still have been peer reviewed, and having reviews is
        not a mark of quality.
      </p>
    </div>
  );
}

render(
  <AppShell<GetReviewsOutput> toolName="openalex_get_reviews">{(data) => <Reviews data={data} />}</AppShell>,
  document.getElementById("app")!
);
