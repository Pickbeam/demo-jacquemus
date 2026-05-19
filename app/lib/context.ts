import {createHydrogenContext} from '@shopify/hydrogen';
import {AppSession} from '~/lib/session';
import {CART_QUERY_FRAGMENT} from '~/lib/fragments';
import {getLocaleFromRequest} from '~/lib/i18n';

// Define the additional context object
const additionalContext = {
  // Additional context for custom properties, CMS clients, 3P SDKs, etc.
  // These will be available as both context.propertyName and context.get(propertyContext)
  // Example of complex objects that could be added:
  // cms: await createCMSClient(env),
  // reviews: await createReviewsClient(env),
} as const;

// Automatically augment HydrogenAdditionalContext with the additional context type
type AdditionalContextType = typeof additionalContext;

declare global {
  interface HydrogenAdditionalContext extends AdditionalContextType {}
}

/**
 * Creates Hydrogen context for React Router 7.9.x
 * Returns HydrogenRouterContextProvider with hybrid access patterns
 *
 * When deployed on Vercel (without Oxygen), env and executionContext are
 * optional and fall back to process.env / no-op respectively.
 */
export async function createHydrogenRouterContext(
  request: Request,
  env?: Env,
  executionContext?: ExecutionContext,
) {
  const resolvedEnv: Env = env ?? ({
    SESSION_SECRET: process.env.SESSION_SECRET!,
    PUBLIC_STORE_DOMAIN: process.env.PUBLIC_STORE_DOMAIN!,
    PUBLIC_STOREFRONT_API_TOKEN: process.env.PUBLIC_STOREFRONT_API_TOKEN!,
    PUBLIC_STOREFRONT_API_VERSION: process.env.PUBLIC_STOREFRONT_API_VERSION!,
    SHOPIFY_ADMIN_API_TOKEN: process.env.SHOPIFY_ADMIN_API_TOKEN,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
    // Optional Shopify vars
    PUBLIC_STOREFRONT_ID: process.env.PUBLIC_STOREFRONT_ID,
    PUBLIC_CHECKOUT_DOMAIN: process.env.PUBLIC_CHECKOUT_DOMAIN,
    PRIVATE_STOREFRONT_API_TOKEN: process.env.PRIVATE_STOREFRONT_API_TOKEN,
    PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: process.env.PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID,
    PUBLIC_CUSTOMER_ACCOUNT_API_URL: process.env.PUBLIC_CUSTOMER_ACCOUNT_API_URL,
    SHOP_ID: process.env.SHOP_ID,
  } as unknown as Env);

  if (!resolvedEnv?.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }

  const waitUntil = executionContext
    ? executionContext.waitUntil.bind(executionContext)
    : (_p: Promise<unknown>) => {};

  // caches API is available in Workers/Edge but not standard Node.js
  const cache =
    typeof caches !== 'undefined' ? await caches.open('hydrogen') : undefined;

  const [session] = await Promise.all([
    AppSession.init(request, [resolvedEnv.SESSION_SECRET]),
  ]);

  const hydrogenContext = createHydrogenContext(
    {
      env: resolvedEnv,
      request,
      cache,
      waitUntil,
      session,
      // Or detect from URL path based on locale subpath, cookies, or any other strategy
      i18n: getLocaleFromRequest(request),
      cart: {
        queryFragment: CART_QUERY_FRAGMENT,
      },
    },
    additionalContext,
  );

  return hydrogenContext;
}
