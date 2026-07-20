import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Falha global no Longitude Geo", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="fatal-error-page">
        <section className="fatal-error-card">
          <h1>Longitude Geo não conseguiu abrir esta tela</h1>
          <p>{this.state.error?.message || "Erro inesperado."}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Recarregar sistema
          </button>
        </section>
      </main>
    );
  }
}
