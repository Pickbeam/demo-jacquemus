import {Suspense} from 'react';
import {Await, NavLink} from 'react-router';
import type {FooterQuery, HeaderQuery} from 'storefrontapi.generated';

interface FooterProps {
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  publicStoreDomain: string;
}

export function Footer({footer: footerPromise, header, publicStoreDomain}: FooterProps) {
  return (
    <Suspense>
      <Await resolve={footerPromise}>
        {() => (
          <footer>
            <FooterServices />
            <FooterMid />
            <FooterNav />
            <FooterBottom />
          </footer>
        )}
      </Await>
    </Suspense>
  );
}

function FooterServices() {
  return (
    <div className="footer-services">
      <div className="footer-service">
        <p className="footer-service-title">Prendre un rendez-vous en boutique</p>
        <p className="footer-service-desc">Paris, Londres, New York, Los Angeles...</p>
      </div>
      <div className="footer-service">
        <p className="footer-service-title">Livraison et retours gratuits</p>
        <p className="footer-service-desc">
          Livraison offerte<br />et retours simplifiés sous 14 jours.
        </p>
      </div>
      <div className="footer-service">
        <p className="footer-service-title">Paiement sécurisé</p>
        <p className="footer-service-desc">
          Visa, Mastercard, Paypal, Apple pay,<br />American express, Klarna
        </p>
      </div>
    </div>
  );
}

function FooterMid() {
  return (
    <div className="footer-mid">
      <div className="footer-newsletter">
        <div className="footer-newsletter-toggle">
          <span className="footer-newsletter-title">S&apos;abonner à la newsletter</span>
          <span>∨</span>
        </div>
        <p className="footer-newsletter-desc">
          Inscrivez-vous pour recevoir par e-mail toutes les informations sur nos
          dernières collections, nos produits, nos défilés de mode et nos projets.
        </p>
        <button className="footer-newsletter-btn" type="button">
          S&apos;enregistrer
        </button>
      </div>
      <div className="footer-contact">
        <p className="footer-contact-title">Besoin d&apos;aide ? Contactez-nous</p>
        <p className="footer-contact-hours">
          Du Lundi au Vendredi de 10:00 à 13:00 et de 14:00 à 21:00,<br />
          les samedis de 10:00 à 13:00 et de 14:00 à 18:00 CET.
        </p>
        <div className="footer-contact-links">
          <a href="/pages/contact">Formulaire de contact</a>
          <a href="/pages/order-tracking">Suivre une commande</a>
          <a href="/pages/returns">Enregistrer un retour</a>
        </div>
      </div>
    </div>
  );
}

function FooterNav() {
  return (
    <div className="footer-nav">
      <div className="footer-nav-group-title">Mentions légales et cookies <span>∨</span></div>
      <div className="footer-nav-group-title">FAQ <span>∨</span></div>
      <div className="footer-nav-group-title">Entreprise <span>∨</span></div>
      <div>
        <p className="footer-social-title">Suivez nous</p>
        <div className="footer-social-links">
          <a href="https://www.instagram.com/jacquemus" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="https://www.facebook.com/jacquemus" target="_blank" rel="noopener noreferrer">Facebook</a>
          <a href="https://www.tiktok.com/@jacquemus" target="_blank" rel="noopener noreferrer">Tiktok</a>
          <a href="https://x.com/jacquemus" target="_blank" rel="noopener noreferrer">X</a>
          <a href="https://www.pinterest.fr/jacquemus" target="_blank" rel="noopener noreferrer">Pinterest</a>
        </div>
      </div>
    </div>
  );
}

function FooterBottom() {
  return (
    <div className="footer-bottom">
      <span className="footer-bottom-copy">© JACQUEMUS {new Date().getFullYear()}</span>
      <NavLink to="/" className="footer-bottom-logo" prefetch="intent">
        Jacquemus
      </NavLink>
      <div className="footer-bottom-right">
        <button type="button">Pays : France Métropolitaine (EUR)</button>
        <button type="button">Langage : français ∨</button>
      </div>
    </div>
  );
}
