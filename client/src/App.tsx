/* Design reminder — “حكاية الورق الملوّن”: the app shell stays light, warm, and calm so the workbook lesson remains the hero. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import LearningApp from "./pages/LearningApp";

const LettersPage = () => <LearningApp page="letters" />;
const SentencesPage = () => <LearningApp page="sentences" />;
const GamesPage = () => <LearningApp page="games" />;
const ProgressPage = () => <LearningApp page="progress" />;

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/letters" component={LettersPage} />
      <Route path="/sentences" component={SentencesPage} />
      <Route path="/games" component={GamesPage} />
      <Route path="/progress" component={ProgressPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
