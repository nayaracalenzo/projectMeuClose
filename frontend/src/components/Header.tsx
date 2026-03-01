
export default function Header () {

 const data = new Date();

 const opcoes = {
   weekday: "long", // nome do dia da semana
   day: "numeric", // dia do mês
   month: "long", // nome do mês
   year: "numeric", // ano
 };

 const dataFormatada = data.toLocaleDateString("pt-BR", opcoes);
 const dataFinal =  dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1); 
  return (
    <header className="w-full text-gray-800 items-center flex justify-end-safe border-b md:border-0 md:static h-20">
      <div className=" px-4  md:px-8">{dataFinal}</div>
    </header>
  );
};
