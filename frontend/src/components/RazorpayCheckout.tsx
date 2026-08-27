import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts, fontSize, spacing } from "@/src/theme";

export interface RazorpayOrder {
  key_id: string;
  order_id: string;
  amount: number;
  currency: string;
}

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
  const insets = useSafeAreaInsets();
  if (!order) return null;

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;background:#FDFBF7">
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    var options = {
      key: "${order.key_id}",
      amount: "${order.amount}",
      currency: "${order.currency}",
      name: "ReturnRide",
      description: "Ride fare",
      order_id: "${order.order_id}",
      prefill: { name: "${name || ""}", contact: "${contact || ""}" },
      theme: { color: "#C1513A" },
      handler: function (response) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "success", data: response }));
      },
      modal: { ondismiss: function () {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "dismiss" }));
      }}
    };
    var rzp = new Razorpay(options);
    rzp.on('payment.failed', function (response){
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "failed", data: response.error }));
    });
    rzp.open();
  </script></body></html>`;

  const onMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "success") onSuccess(msg.data);
      else onClose();
    } catch {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Secure Payment</Text>
          <Pressable testID="razorpay-close" onPress={onClose} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={26} color={colors.onSurface} />
          </Pressable>
        </View>
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          javaScriptEnabled
          domStorageEnabled
          onMessage={onMessage}
          style={{ flex: 1 }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontFamily: fonts.display, fontSize: fontSize.xl, fontWeight: "700", color: colors.onSurface },
});
