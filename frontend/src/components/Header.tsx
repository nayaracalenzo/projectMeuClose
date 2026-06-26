export default function Header() {
  const data = new Date();

  const opcoes: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  };

  const dataFormatada = data.toLocaleDateString("pt-BR", opcoes);
  const dataFinal = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  return (
    <header className="hidden glass-panel md:flex h-20 w-full items-center justify-end border-b border-outline-variant/25 text-primary">
      <div className="px-4 text-base font-medium md:px-8">{dataFinal}</div>
    </header>
  );
}
