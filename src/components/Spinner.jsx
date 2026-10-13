export default function Spinner({ message = '불러오는 중…' }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {message && <p className="spinner-msg">{message}</p>}
    </div>
  );
}
