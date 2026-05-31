import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="tool-card" style={{ textAlign: "center" }}>
      <h1 style={{ marginTop: 0 }}>Page not found</h1>
      <p style={{ color: "var(--muted)" }}>This page does not exist.</p>
      <Link to="/" className="btn-primary" style={{ display: "inline-flex", marginTop: "1rem" }}>
        Back to ExifScrub
      </Link>
    </div>
  );
}
