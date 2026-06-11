import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

const copy = {
  en: {
    title: "This panel could not be displayed",
    detail: "Reload the page to restore the current interface. Saved audit tasks remain available.",
    reload: "Reload page",
  },
  "zh-CN": {
    title: "页面暂时无法显示",
    detail: "请重新加载页面恢复界面，已保存的检查任务仍然可用。",
    reload: "重新加载",
  },
  "zh-TW": {
    title: "頁面暫時無法顯示",
    detail: "請重新載入頁面以恢復介面，已儲存的檢查任務仍然可用。",
    reload: "重新載入",
  },
};

function browserLanguage() {
  const language = (navigator.language || "en").toLowerCase();
  if (language.includes("tw") || language.includes("hk") || language.includes("hant")) return "zh-TW";
  if (language.startsWith("zh")) return "zh-CN";
  return "en";
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("soos-render-error", {
      message: error?.message || String(error),
      componentStack: info?.componentStack || "",
    });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const text = copy[browserLanguage()];
    return (
      <main className="fatal-error">
        <AlertTriangle size={28} />
        <h1>{text.title}</h1>
        <p>{text.detail}</p>
        <button type="button" onClick={() => window.location.reload()}>
          <RotateCcw size={16} />
          {text.reload}
        </button>
      </main>
    );
  }
}
