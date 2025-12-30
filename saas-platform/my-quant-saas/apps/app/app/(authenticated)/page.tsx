import { redirect } from "next/navigation";

// 根页面重定向到 Dashboard
const App = async () => {
  redirect("/dashboard");
};

export default App;
