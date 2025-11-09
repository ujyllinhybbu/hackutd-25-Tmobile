import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Chatbot from "./pages/Chatbot.jsx";
import NotFound from "./pages/NotFound.jsx"; // optional but recommended
import Feedback from "./pages/Feedback.jsx";
import Support from "./pages/SupportPanel.jsx";

function App() {
  return (
    <Router>
      <Routes>
        {/* Dashboard (default route) */}
        <Route path="/" element={<Dashboard />} />

        {/* Chatbot page */}
        <Route path="/chatbot" element={<Chatbot />} />
        {/* Feedback page */}
        <Route path="/feedback" element={<Feedback />} />
        {/* Catch-all for undefined routes */}
        {/* Staff page where they can see all of customer data */}
        <Route path="/support" element={<Support />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
