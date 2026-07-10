import axios from "axios";
import { Eye, EyeClosed } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import NoticeToast from "../components/NoticeToast";
import { postRequest } from "../services/request";
import { consumeAuthNotice } from "../utils/auth";

type LoginNotice = {
  tone: "success" | "warning" | "error";
  title?: string;
  message: string;
};

export default function LoginPage() {
  const [formData, setFormData] = useState({
    user: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<LoginNotice | null>(null);

  const navigate = useNavigate();

  function showNotice(nextNotice: LoginNotice) {
    setNotice(nextNotice);
  }

  useEffect(() => {
    const authNotice = consumeAuthNotice();

    if (authNotice === "expired") {
      showNotice({
        tone: "warning",
        title: "Sessão expirada",
        message: "Seu acesso expirou. Faça login novamente para continuar.",
      });
    }

    if (authNotice === "logged_out") {
      showNotice({
        tone: "success",
        title: "Logout realizado",
        message: "Você saiu com segurança da sua conta.",
      });
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);

    const username = formData.user.trim().toLowerCase();

    if (!username || !formData.password) {
      showNotice({
        tone: "warning",
        title: "Campos obrigatórios",
        message: "Informe usuário e senha para continuar.",
      });
      return;
    }

    try {
      setLoading(true);
      const result = await postRequest("/auth/login", {
        username,
        password: formData.password,
      });
      localStorage.setItem("token", result.token);
      navigate("/home");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (!error.response) {
          showNotice({
            tone: "error",
            title: "Falha na conexão",
            message:
              "Não foi possível conectar ao servidor. Verifique a conexão e tente novamente.",
          });
          return;
        }

        if (error.response.status === 401) {
          showNotice({
            tone: "error",
            title: "Acesso negado",
            message: "Usuário ou senha incorretos.",
          });
          return;
        }

        showNotice({
          tone: "error",
          title: "Erro ao entrar",
          message:
            error.response.data?.message || "Não foi possível realizar o login no momento.",
        });
        return;
      }

      showNotice({
        tone: "error",
        title: "Erro inesperado",
        message: "Ocorreu um erro inesperado ao tentar entrar.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex h-screen items-center justify-center overflow-hidden bg-[url('/bg-soft.jpeg')] bg-cover bg-no-repeat bg-position-[center_20%] px-4">
      <div className="absolute inset-0 bg-linear-to-br from-[#2a2324]/48 via-[#6b5b5e]/26 to-[#efe9e6]/40" />
      <div className="relative w-full max-w-140 rounded-xl border border-[#ffffff66] bg-[#F6F1EF]/88 p-8 shadow-2xl backdrop-blur-md md:p-12">
        <div className="mb-6 flex flex-col items-center">
          <div className="flex items-center justify-center gap-2">
            <img className="h-16 opacity-80" src="/manequim.png" alt="logo" />
            <h1 className="font-editorial text-[32px] uppercase tracking-[0.06em] text-[#161314]">
              Meu Close
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6">
          <div>
            <input
              className="h-12 w-full rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 text-xl text-[#2a2526] placeholder:text-[#8b8284] shadow-xs transition duration-200 focus:ring-2 focus:ring-[#8a4d5dcf] focus:outline-none"
              type="text"
              name="user"
              id="user"
              onChange={handleChange}
              autoComplete="username"
              placeholder="Digite seu usuario"
            />
          </div>

          <div className="relative">
            <input
              className="h-12 w-full rounded-lg border border-[#a59797] bg-[#f9f7f6] px-3 pr-10 text-xl text-[#2a2526] placeholder:text-[#8b8284] shadow-xs transition duration-200 focus:ring-2 focus:ring-[#8a4d5dcf] focus:outline-none"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              id="password"
              onChange={handleChange}
              placeholder="Digite sua senha"
            />
            <button
              type="button"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-2 flex items-center text-[#746d6f] hover:text-[#3c3436]"
            >
              {showPassword ? <Eye /> : <EyeClosed />}
            </button>
          </div>

          <Button
            type="submit"
            size="lg"
            className="mb-6"
            variant="tertiary"
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>

      <NoticeToast
        open={Boolean(notice)}
        tone={notice?.tone || "warning"}
        title={notice?.title}
        message={notice?.message || ""}
        onClose={() => setNotice(null)}
      />
    </main>
  );
}
