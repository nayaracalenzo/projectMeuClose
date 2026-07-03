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
    <header className="hidden bg-[#f5f5f5] h-20 w-full items-center justify-end border-b border-outline-variant/25 text-primary md:flex">
      <div className="flex items-center gap-3 px-4 md:px-8">
        <div className="text-base font-medium">{dataFinal}</div>
      </div>
    </header>
  );
}
