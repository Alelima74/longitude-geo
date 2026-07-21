import React, { useEffect, useMemo, useState } from "react";
import "./pwa-install.css";

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

export default function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandaloneMode());
  const [showHelp, setShowHelp] = useState(false);
  const ios = useMemo(isIosDevice, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    setShowHelp(true);
  }

  return (
    <>
      <button className="longitude-pwa-install" type="button" onClick={install}>
        <img src="/icons/icon-48.png" alt="" />
        <span>Instalar aplicativo</span>
      </button>

      {showHelp && (
        <div className="longitude-pwa-backdrop" role="presentation" onClick={() => setShowHelp(false)}>
          <section
            className="longitude-pwa-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="longitude-pwa-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="longitude-pwa-close"
              onClick={() => setShowHelp(false)}
              aria-label="Fechar"
            >
              ×
            </button>
            <img className="longitude-pwa-icon" src="/icons/icon-192.png" alt="Longitude Geo" />
            <h2 id="longitude-pwa-title">Instalar Longitude Geo</h2>

            {ios ? (
              <ol>
                <li>Abra este endereço no <strong>Safari</strong>.</li>
                <li>Toque no botão <strong>Compartilhar</strong>.</li>
                <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
                <li>Ative <strong>Abrir como App</strong>, quando a opção aparecer, e confirme.</li>
              </ol>
            ) : (
              <ol>
                <li>Abra o menu do navegador.</li>
                <li>Escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
                <li>Confirme a instalação.</li>
              </ol>
            )}

            <p>
              Endereço oficial:
              <br />
              <strong>longitude-geo-intelligence.vercel.app</strong>
            </p>
          </section>
        </div>
      )}
    </>
  );
}
