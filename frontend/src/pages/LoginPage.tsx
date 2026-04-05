import { Button } from "../components/Button";
import { useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
    const [formData, setFormData] = useState({
      user: "",
      password: "",
    });

      const navigate = useNavigate();

      function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;

        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }));
      }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (formData.user === "lia" && formData.password === "27712864") {
    navigate("/home");
    }
  }
  return (
    <main
      className={`bg-[url('/bg.jpeg')] bg-cover bg-no-repeat bg-position-[center_20%] h-screen flex justify-center items-center`}
    >
      <div className="bg-(--brand-primary-light)/90 p-12 rounded-lg w-[50%] flex justify-between gap-6 shadow-xl">
        <div className="flex items-center w-[40%]">
          MEU CLOSE
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4 w-[55%]">
          <div>
            <input
              className="w-full border h-12 border-(--surface-base) rounded-lg px-2 text-xl shadow-xs"
              type="user"
              name="user"
              id="user"
              onChange={handleChange}
              placeholder="Digite seu usuário"
            />
          </div>
          <div>
            <input
              className="w-full border h-12 border-(--surface-base) rounded-lg px-2 text-xl shadow-xs"
              type="password"
              name="password"
              id="password"
              onChange={handleChange}
              placeholder="Digite sua senha"
            />
          </div>
          <Button type="submit" size="lg">
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}



