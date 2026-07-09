// import { getAuth } from 'firebase/auth';
// import { useRouter } from 'next/navigation';

// declare global {
//   interface Window {
//     Razorpay: any;
//   }
// }

// const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '';

// function loadRazorpayScript(): Promise<void> {
//   return new Promise((resolve, reject) => {
//     if (typeof window !== 'undefined' && window.Razorpay) { 
//       resolve(); 
//       return; 
//     }
//     const script = document.createElement('script');
//     script.src = 'https://checkout.razorpay.com/v1/checkout.js';
//     script.async = true;
//     script.onload = () => resolve();
//     script.onerror = () => reject(new Error('Failed to load Razorpay script'));
//     document.body.appendChild(script);
//   });
// }

// export interface RazorpayCheckoutOptions {
//   uid: string;
//   email?: string;
//   name?: string;
//   authToken?: string;
//   router?: ReturnType<typeof useRouter>;
//   onSuccess?: (response: RazorpayPaymentResponse) => void;
//   onDismiss?: () => void;
//   onError?: (error: Error) => void;
// }

// export interface RazorpayPaymentResponse {
//   razorpay_payment_id: string;
//   razorpay_order_id: string;
//   razorpay_signature: string;
// }

// export interface RazorpayOrderResponse {
//   order_id: string;
//   amount: number;
//   currency: string;
// }

// async function createRazorpayOrder(
//   authToken?: string
// ): Promise<RazorpayOrderResponse> {
//   const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

//   const headers: HeadersInit = {
//     'Content-Type': 'application/json',
//   };

//   if (authToken) {
//     headers['Authorization'] = `Bearer ${authToken}`;
//   }

//   const response = await fetch(`${BASE_URL}/api/v1/razorpay/create-order`, {
//     method: 'POST',
//     headers,
//   });

//   if (!response.ok) {
//     const errorData = await response.json().catch(() => ({}));
//     const errorMsg = errorData.detail || response.statusText || 'Unknown error';
//     throw new Error(`Failed to create order: ${errorMsg}`);
//   }

//   return await response.json();
// }

// async function notifyPaymentSuccess(
//   authToken?: string
// ): Promise<void> {
//   const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

//   const headers: HeadersInit = {
//     'Content-Type': 'application/json',
//   };

//   if (authToken) {
//     headers['Authorization'] = `Bearer ${authToken}`;
//   }

//   const response = await fetch(
//     `${BASE_URL}/api/v1/razorpay/payment-success`,
//     {
//       method: 'POST',
//       headers,
//     }
//   );

//   if (!response.ok) {
//     const errorData = await response.json().catch(() => ({}));
//     const errorMsg = errorData.detail || response.statusText || 'Unknown error';
//     throw new Error(`Failed to verify payment: ${errorMsg}`);
//   }

//   return await response.json();
// }

// export async function openRazorpayCheckout({
//   uid,
//   email = '',
//   name = '',
//   authToken,
//   router,
//   onSuccess,
//   onDismiss,
//   onError,
// }: RazorpayCheckoutOptions): Promise<void> {
//   try {
//     if (!RAZORPAY_KEY_ID) {
//       throw new Error(
//         'Razorpay Key ID not configured. Set NEXT_PUBLIC_RAZORPAY_KEY_ID in .env.local'
//       );
//     }

//     await loadRazorpayScript();

//     const orderData = await createRazorpayOrder(authToken);

//     const options = {
//       key: RAZORPAY_KEY_ID,
//       order_id: orderData.order_id,
//       amount: orderData.amount,
//       currency: orderData.currency,

//       name: 'Zenntraa',
//       description: 'Pro Plan — 1,000 queries/month',
//       image: '/logo.png',

//       prefill: {
//         name: name || undefined,
//         email: email || undefined,
//       },

//       notes: {
//         user_id: uid,
//         plan: 'pro',
//       },

//       theme: {
//         color: '#7c83f5',
//       },

//       modal: {
//         ondismiss: () => {
//           onDismiss?.();
//         },
//       },

//       handler: async (response: RazorpayPaymentResponse) => {
//         try {
//           const currentUser = getAuth().currentUser;
//           const token = await currentUser?.getIdToken() ?? '';

//           await notifyPaymentSuccess(token);

//           onSuccess?.(response);

//           if (router) {
//             router.push('/dashboard?payment=success');
//           }
//         } catch (error) {
//           const err = error instanceof Error ? error : new Error(String(error));
//           console.error('Payment success handler error:', err);
//           onError?.(err);
//         }
//       },
//     };

//     const rzp = new window.Razorpay(options);

//     rzp.on('payment.failed', (response: any) => {
//       const error = new Error(`Payment failed: ${response.error?.description}`);
//       onError?.(error);
//     });

//     rzp.open();
//   } catch (error) {
//     const err = error instanceof Error ? error : new Error(String(error));
//     onError?.(err);
//     throw err;
//   }
// }



import { getAuth } from 'firebase/auth';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '';

// Load Razorpay script dynamically — only when needed
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.Razorpay) { 
      resolve(); 
      return; 
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay script'));
    document.body.appendChild(script);
  });
}

export interface RazorpayCheckoutOptions {
  uid: string;
  email?: string;
  name?: string;
  authToken?: string;
  router?: ReturnType<typeof useRouter>;
  /** Called when payment succeeds */
  onSuccess?: (response: RazorpayPaymentResponse) => void;
  /** Called when user dismisses checkout */
  onDismiss?: () => void;
  /** Called on any error */
  onError?: (error: Error) => void;
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayOrderResponse {
  order_id: string;
  amount: number;
  currency: string;
}

/**
 * Creates a Razorpay order by calling the backend
 */
async function createRazorpayOrder(
  authToken?: string
): Promise<RazorpayOrderResponse> {
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}/api/v1/razorpay/create-order`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.detail || response.statusText || 'Unknown error';
    throw new Error(`Failed to create order: ${errorMsg}`);
  }

  return await response.json();
}

/**
 * Notifies backend of successful payment and performs verification
 */
async function notifyPaymentSuccess(
  authToken?: string
): Promise<void> {
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(
    `${BASE_URL}/api/v1/razorpay/payment-success`,
    {
      method: 'POST',
      headers,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.detail || response.statusText || 'Unknown error';
    throw new Error(`Failed to verify payment: ${errorMsg}`);
  }

  return await response.json();
}

/**
 * Opens Razorpay checkout for Zenntraa Pro subscription.
 *
 * Flow:
 * 1. Frontend calls backend to create order
 * 2. Opens Razorpay modal with order details
 * 3. User completes payment in modal
 * 4. Success handler called with payment details
 * 5. Frontend notifies backend to verify and upgrade plan
 * 6. User redirected to dashboard with success message
 */
export async function openRazorpayCheckout({
  uid,
  email = '',
  name = '',
  authToken,
  router,
  onSuccess,
  onDismiss,
  onError,
}: RazorpayCheckoutOptions): Promise<void> {
  try {
    if (!RAZORPAY_KEY_ID) {
      throw new Error(
        'Razorpay Key ID not configured. Set NEXT_PUBLIC_RAZORPAY_KEY_ID in .env.local'
      );
    }

    // ────────────────────────────────────────────────────────────────
    // Step 1: Load Razorpay script
    // ────────────────────────────────────────────────────────────────
    await loadRazorpayScript();

    // ────────────────────────────────────────────────────────────────
    // Step 2: Create order on backend
    // ────────────────────────────────────────────────────────────────
    const orderData = await createRazorpayOrder(authToken);

    // ────────────────────────────────────────────────────────────────
    // Step 3: Prepare checkout options
    // ────────────────────────────────────────────────────────────────
    const options = {
      key: RAZORPAY_KEY_ID,
      order_id: orderData.order_id,           // ✅ FIXED: Using order_id
      amount: orderData.amount,
      currency: orderData.currency,

      // Branding
      name: 'Zenntraa',
      description: 'Pro Plan — 1,000 queries/month',
      image: '/logo.png',

      // Pre-fill user details
      prefill: {
        name: name || undefined,
        email: email || undefined,
      },

      // Metadata
      notes: {
        user_id: uid,
        plan: 'pro',
      },

      // Theme
      theme: {
        color: '#7c83f5',
      },

      // Modal behavior
      modal: {
        ondismiss: () => {
          onDismiss?.();
        },
      },

      // Success handler — verify payment and redirect
      handler: async (response: RazorpayPaymentResponse) => {
        try {
          // Get Firebase ID token
          const currentUser = getAuth().currentUser;
          const token = await currentUser?.getIdToken() ?? '';

          // Notify backend of successful payment for verification
          await notifyPaymentSuccess(token);

          // Call custom success handler if provided
          onSuccess?.(response);

          // Redirect to dashboard with success message
          if (router) {
            router.push('/dashboard?payment=success');
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          console.error('Payment success handler error:', err);
          onError?.(err);
        }
      },
    };

    // ────────────────────────────────────────────────────────────────
    // Step 4: Open checkout
    // ────────────────────────────────────────────────────────────────
    const rzp = new window.Razorpay(options);

    // Additional error handler for payment failures
    rzp.on('payment.failed', (response: any) => {
      const error = new Error(`Payment failed: ${response.error?.description}`);
      onError?.(error);
    });

    rzp.open();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
    throw err;
  }
}