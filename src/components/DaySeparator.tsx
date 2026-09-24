/** "— sábado, 23 de setembro —" entre as mensagens de dias diferentes. */
export function DaySeparator({ label }: { label: string }) {
  return (
    <li className="day-sep">
      <span>— {label} —</span>
    </li>
  );
}
