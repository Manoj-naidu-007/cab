import React, { useEffect } from "react";

export interface RazorpayOrder {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
}

// Web checkout — uses Razorpay's checkout.js and the handler callback.
export function RazorpayCheckout({
  visible,
  order,
  name,
  contact,
  onSuccess,
  onClose,
}: {
  visible: boolean;
  order: RazorpayOrder | null;
  name?: string;
  contact?: string;
  onSuccess: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!visible || !order) return;
    let cancelled = false;

    const open = () => {
      if (cancelled) return;
      const w = window as any;
      if (!w.Razorpay) return;
      const rzp = new w.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "ReturnRide",
        description: "Ride fare",
        order_id: order.order_id,
        prefill: { name: name || "", contact: contact || "" },
        theme: { color: "#C1513A" },
        handler: (response: any) => onSuccess(response),
        modal: { ondismiss: () => onClose() },
      });
      rzp.open();
    };

    const w = window as any;
    if (w.Razorpay) {
      open();
    } else {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = open;
      document.body.appendChild(script);
    }
    return () => {
      cancelled = true;
    };
  }, [visible, order, name, contact, onSuccess, onClose]);

  return null;
}
