// Dart has no bundled grammar (no prebuilt WASM upstream) — exercises
// tier-2 lexical resolution for a real language, not just shell scripts.
const int maxItems = 25;

class CartModel {
  final List<String> items = [];

  void addItem(String sku) {
    items.add(sku);
  }

  double totalPrice() {
    return items.length * 9.99;
  }
}

String formatPrice(double value) {
  return '\$${value.toStringAsFixed(2)}';
}
