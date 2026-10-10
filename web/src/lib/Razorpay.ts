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

//       name: 'Xenderia',
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



