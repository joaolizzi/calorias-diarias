export default function StatTile({ value, label }) {
  return (
    <div className="stat">
      <div className="v num">{value}</div>
      <div className="l">{label}</div>
    </div>
  );
}