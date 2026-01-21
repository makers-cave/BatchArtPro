import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { EditorProvider } from "./context/EditorContext";
import { TemplateEditor } from "./components/editor/TemplateEditor";
import { Toaster } from "./components/ui/sonner";

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <EditorProvider>
        <div className="App">
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<TemplateEditor />} />
            </Routes>
          </BrowserRouter>
          <Toaster position="bottom-right" />
        </div>
      </EditorProvider>
    </ThemeProvider>
  );
}

export default App;
