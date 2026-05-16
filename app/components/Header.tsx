import {Suspense, useState, useEffect} from 'react';
import {Await, NavLink, useAsyncValue, useLocation} from 'react-router';
import {
  type CartViewPayload,
  useAnalytics,
  useOptimisticCart,
} from '@shopify/hydrogen';
import type {HeaderQuery, CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';

interface HeaderProps {
  header: HeaderQuery;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
}

type Viewport = 'desktop' | 'mobile';

export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
}: HeaderProps) {
  const {shop, menu} = header;
  const location = useLocation();
  const isHome = location.pathname === '/' || /^\/[a-z]{2}(-[A-Z]{2})?$/.test(location.pathname);
  const [scrolled, setScrolled] = useState(!isHome);

  useEffect(() => {
    if (!isHome) {
      setScrolled(true);
      return;
    }
    const onScroll = () => setScrolled(window.scrollY > 20);
    setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, {passive: true});
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHome]);

  return (
    <header className={`header${!scrolled ? ' header--transparent' : ''}`}>
      <NavLink prefetch="intent" to="/" end style={{lineHeight: 0}}>
        <img
          src="/jacquemus-logo.png"
          alt="Jacquemus"
          style={{
            height: '18px',
            display: 'block',
            filter: scrolled ? 'none' : 'invert(1)',
            transition: 'filter 0.3s ease',
          }}
        />
      </NavLink>
      <HeaderMenu
        menu={menu}
        viewport="desktop"
        primaryDomainUrl={header.shop.primaryDomain.url}
        publicStoreDomain={publicStoreDomain}
      />
      <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} scrolled={scrolled} />
    </header>
  );
}

export function HeaderMenu({
  menu,
  primaryDomainUrl,
  viewport,
  publicStoreDomain,
}: {
  menu: HeaderProps['header']['menu'];
  primaryDomainUrl: HeaderProps['header']['shop']['primaryDomain']['url'];
  viewport: Viewport;
  publicStoreDomain: HeaderProps['publicStoreDomain'];
}) {
  const className = `header-menu-${viewport}`;
  const {close} = useAside();

  return (
    <nav className={className} role="navigation">
      {viewport === 'mobile' && (
        <NavLink
          end
          onClick={close}
          prefetch="intent"
          style={({isActive, isPending}) => ({
            fontWeight: isActive ? 'bold' : undefined,
            color: isPending ? 'grey' : 'black',
          })}
          to="/"
        >
          Home
        </NavLink>
      )}
      {(menu || FALLBACK_HEADER_MENU).items.map((item) => {
        if (!item.url) return null;

        const url =
          item.url.includes('myshopify.com') ||
          item.url.includes(publicStoreDomain) ||
          item.url.includes(primaryDomainUrl)
            ? new URL(item.url).pathname
            : item.url;

        const isShopper = item.title.toLowerCase().includes('shopper');
        return (
          <NavLink
            className="header-menu-item"
            end
            key={item.id}
            onClick={close}
            prefetch="intent"
            to={url}
            style={({isActive, isPending}) => ({
              fontWeight: isActive ? '600' : undefined,
              color: isPending ? '#999' : isShopper ? '#c8a96e' : '#444',
            })}
          >
            {isShopper ? `${item.title} ✦` : item.title}
          </NavLink>
        );
      })}
    </nav>
  );
}

function HeaderCtas({
  isLoggedIn,
  cart,
  scrolled,
}: Pick<HeaderProps, 'isLoggedIn' | 'cart'> & {scrolled: boolean}) {
  const linkColor = scrolled ? '#444' : 'rgba(255,255,255,0.75)';
  return (
    <nav className="header-ctas" role="navigation">
      <HeaderMenuMobileToggle />
      <NavLink
        prefetch="intent"
        to="/account"
        style={{
          fontSize: '9px',
          letterSpacing: '0.2em',
          textTransform: 'uppercase' as const,
          color: linkColor,
          textDecoration: 'none',
          fontWeight: 300,
          transition: 'color 0.3s',
        }}
      >
        <Suspense fallback="Sign in">
          <Await resolve={isLoggedIn} errorElement="Sign in">
            {(isLoggedIn) => (isLoggedIn ? 'Account' : 'Sign in')}
          </Await>
        </Suspense>
      </NavLink>
      <SearchToggle scrolled={scrolled} />
      <CartToggle cart={cart} scrolled={scrolled} />
    </nav>
  );
}

function HeaderMenuMobileToggle() {
  const {open} = useAside();
  return (
    <button
      className="header-menu-mobile-toggle reset"
      onClick={() => open('mobile')}
    >
      <h3>☰</h3>
    </button>
  );
}

function SearchToggle({scrolled}: {scrolled: boolean}) {
  const {open} = useAside();
  const linkColor = scrolled ? '#444' : 'rgba(255,255,255,0.75)';
  return (
    <button
      className="reset"
      onClick={() => open('search')}
      style={{
        fontSize: '9px',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: linkColor,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 300,
        transition: 'color 0.3s',
      }}
    >
      Search
    </button>
  );
}

function CartBadge({count, scrolled}: {count: number; scrolled: boolean}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();
  const linkColor = scrolled ? '#444' : 'rgba(255,255,255,0.75)';

  return (
    <a
      href="/cart"
      style={{
        fontSize: '9px',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: linkColor,
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontWeight: 300,
        transition: 'color 0.3s',
      }}
      onClick={(e) => {
        e.preventDefault();
        open('cart');
        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: window.location.href || '',
        } as CartViewPayload);
      }}
    >
      Cart
      {count > 0 && (
        <span
          aria-label={`(items: ${count})`}
          style={{
            background: scrolled ? '#1a1a1a' : 'rgba(255,255,255,0.9)',
            color: scrolled ? 'white' : '#1a1a1a',
            width: '17px',
            height: '17px',
            borderRadius: '50%',
            fontSize: '9px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.3s, color 0.3s',
          }}
        >
          {count}
        </span>
      )}
    </a>
  );
}

function CartToggle({cart, scrolled}: Pick<HeaderProps, 'cart'> & {scrolled: boolean}) {
  return (
    <Suspense fallback={<CartBadge count={0} scrolled={scrolled} />}>
      <Await resolve={cart}>
        <CartBanner scrolled={scrolled} />
      </Await>
    </Suspense>
  );
}

function CartBanner({scrolled}: {scrolled: boolean}) {
  const originalCart = useAsyncValue() as CartApiQueryFragment | null;
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} scrolled={scrolled} />;
}

const FALLBACK_HEADER_MENU = {
  id: 'gid://shopify/Menu/199655587896',
  items: [
    {
      id: 'gid://shopify/MenuItem/461609500728',
      resourceId: null,
      tags: [],
      title: 'Collections',
      type: 'HTTP',
      url: '/collections',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609533496',
      resourceId: null,
      tags: [],
      title: 'Blog',
      type: 'HTTP',
      url: '/blogs/journal',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609566264',
      resourceId: null,
      tags: [],
      title: 'Policies',
      type: 'HTTP',
      url: '/policies',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609599032',
      resourceId: 'gid://shopify/Page/92591030328',
      tags: [],
      title: 'About',
      type: 'PAGE',
      url: '/pages/about',
      items: [],
    },
  ],
};

