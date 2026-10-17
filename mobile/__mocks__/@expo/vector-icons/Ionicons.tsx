// The real icons load a font file, which doesn't exist in tests.
function Ionicons() {
  return null;
}
Ionicons.glyphMap = {} as Record<string, number>;

export default Ionicons;
