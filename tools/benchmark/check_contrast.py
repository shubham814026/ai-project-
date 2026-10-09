"""
tools/benchmark/check_contrast.py - WCAG AA Contrast Verification Script
Evaluates luminance ratios of all text and UI color pairings against WCAG 2.1 specifications:
- Normal text (< 18pt / 14pt bold): Minimum 4.5:1
- Large text (>= 18pt / 14pt bold): Minimum 3.0:1
- UI components and graphics: Minimum 3.0:1
"""

def hex_to_rgb(hex_code):
    hex_code = hex_code.lstrip('#')
    return tuple(int(hex_code[i:i+2], 16) for i in (0, 2, 4))

def relative_luminance(rgb):
    def channel_lum(val):
        c = val / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * channel_lum(r) + 0.7152 * channel_lum(g) + 0.0722 * channel_lum(b)

def contrast_ratio(hex1, hex2):
    lum1 = relative_luminance(hex_to_rgb(hex1))
    lum2 = relative_luminance(hex_to_rgb(hex2))
    l_max = max(lum1, lum2)
    l_min = min(lum1, lum2)
    return (l_max + 0.05) / (l_min + 0.05)

PALETTE = {
    "Deep Forest Reserve (BG)": "#0F251E",
    "Dark Moss (Surface)": "#16382D",
    "Soft Off-White (Text Primary)": "#F4F6F4",
    "Sage Gray (Text Secondary)": "#94A39E",
    "Antique Brass (Accent / CTA)": "#C5A059",
    "Mint Cyan (Skeleton)": "#5EEAD4",
    "Warm Amber (Adjustment)": "#FF9F43",
    "Fresh Green (Aligned)": "#4ADE80",
    "Soft Coral (Error)": "#F0746B",
}

PAIRS_TO_AUDIT = [
    ("Soft Off-White (Text Primary)", "Deep Forest Reserve (BG)", 4.5, "Text Primary on Background"),
    ("Soft Off-White (Text Primary)", "Dark Moss (Surface)", 4.5, "Text Primary on Card Surface"),
    ("Sage Gray (Text Secondary)", "Deep Forest Reserve (BG)", 4.5, "Secondary text on Background"),
    ("Sage Gray (Text Secondary)", "Dark Moss (Surface)", 3.0, "Secondary text on Surface (14px+ / UI)"),
    ("Antique Brass (Accent / CTA)", "Deep Forest Reserve (BG)", 3.0, "Accent on Background"),
    ("Deep Forest Reserve (BG)", "Antique Brass (Accent / CTA)", 4.5, "CTA Button Text (#0F251E on #C5A059)"),
    ("Mint Cyan (Skeleton)", "Deep Forest Reserve (BG)", 3.0, "Skeleton stroke on dark background"),
    ("Warm Amber (Adjustment)", "Deep Forest Reserve (BG)", 3.0, "Warning indicators on dark background"),
    ("Fresh Green (Aligned)", "Deep Forest Reserve (BG)", 3.0, "Success state on dark background"),
    ("Soft Coral (Error)", "Deep Forest Reserve (BG)", 3.0, "Error state on dark background"),
]

def audit():
    print("=== WCAG 2.1 AA Contrast Ratio Verification ===")
    all_passed = True
    results = []

    for name1, name2, min_ratio, context in PAIRS_TO_AUDIT:
        c1 = PALETTE[name1]
        c2 = PALETTE[name2]
        ratio = contrast_ratio(c1, c2)
        passed = ratio >= min_ratio
        status = "PASS" if passed else "FAIL"
        if not passed: all_passed = False

        results.append({
            "foreground": name1,
            "background": name2,
            "hex_fg": c1,
            "hex_bg": c2,
            "ratio": ratio,
            "min_required": min_ratio,
            "status": status,
            "context": context
        })
        print(f"[{status}] {ratio:.2f}:1 (Req: {min_ratio:.1f}:1) -> {name1} on {name2} [{context}]")

    print("\nSummary:")
    if all_passed:
        print("[AUDIT SUCCESS] 100% of evaluated color combinations satisfy WCAG AA requirements.")
    else:
        print("[AUDIT WARNING] Certain pairings fall below required thresholds.")
    return results

if __name__ == '__main__':
    audit()
