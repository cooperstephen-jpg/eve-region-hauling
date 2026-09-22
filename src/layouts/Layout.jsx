// src/layouts/Layout.jsx
import './Layout.css';

export default function Layout({ children }) {
    return (
        <>
            <nav className="global-nav" role="navigation">
                <div className="nav-left">
                    <a href="/" className="eve-button" data-page="index">
                        <img
                            src="favicon.svg"
                            className="nav-icon"
                            loading="lazy"
                            width="22"
                            height="22"
                            alt="Logo"
                        />
                        EVE Region Hauling
                    </a>
                </div>
            </nav>

            <div className="layout-wrapper">
                <main className="layout-content">
                    {children}
                </main>

                <footer className="global-footer">
                    <div className="footer-content">
                        <p>Not affiliated with CCP Games. EVE Online and the EVE logo are the registered trademarks of CCP hf.</p>
                    </div>
                </footer>
            </div>
        </>
    );
}
