/* states-data.js — BUILT 2026-09-29 · states-data-1a
   Every state (and DC), where it sits on the tile map, its population, and its cannabis law.

   Tile map: one square per state, placed roughly where the state is. Easy to click on a phone,
   and small states are as big as large ones.

   pop:      2020 U.S. Census, millions of residents.
   cannabis: adult = legal for adults · medical = medical program · cbd = CBD / low-THC only · none = illegal
             Source: DISA, "Marijuana Legality by State", updated September 1, 2026.
             ⚠ Laws change. Re-check this list every quarter and change CANNABIS_AS_OF when you do. */

(function () {
  var S = [
    // code, name, row, col, pop, cannabis, note
    ["AK", "Alaska", 0, 0, 0.73, "adult"],
    ["ME", "Maine", 0, 11, 1.36, "adult"],
    ["VT", "Vermont", 1, 10, 0.64, "adult"],
    ["NH", "New Hampshire", 1, 11, 1.38, "medical", "decriminalized"],
    ["WA", "Washington", 2, 1, 7.71, "adult"],
    ["ID", "Idaho", 2, 2, 1.84, "none"],
    ["MT", "Montana", 2, 3, 1.08, "adult"],
    ["ND", "North Dakota", 2, 4, 0.78, "medical", "decriminalized"],
    ["MN", "Minnesota", 2, 5, 5.71, "adult"],
    ["IL", "Illinois", 2, 6, 12.8, "adult"],
    ["WI", "Wisconsin", 2, 7, 5.89, "cbd"],
    ["MI", "Michigan", 2, 8, 10.1, "adult"],
    ["NY", "New York", 2, 9, 20.2, "adult"],
    ["RI", "Rhode Island", 2, 10, 1.10, "adult"],
    ["MA", "Massachusetts", 2, 11, 7.03, "adult"],
    ["OR", "Oregon", 3, 1, 4.24, "adult"],
    ["NV", "Nevada", 3, 2, 3.10, "adult"],
    ["WY", "Wyoming", 3, 3, 0.58, "none"],
    ["SD", "South Dakota", 3, 4, 0.89, "medical"],
    ["IA", "Iowa", 3, 5, 3.19, "cbd"],
    ["IN", "Indiana", 3, 6, 6.79, "cbd"],
    ["OH", "Ohio", 3, 7, 11.8, "adult"],
    ["PA", "Pennsylvania", 3, 8, 13.0, "medical"],
    ["NJ", "New Jersey", 3, 9, 9.29, "adult"],
    ["CT", "Connecticut", 3, 10, 3.61, "adult"],
    ["CA", "California", 4, 1, 39.5, "adult"],
    ["UT", "Utah", 4, 2, 3.27, "medical"],
    ["CO", "Colorado", 4, 3, 5.77, "adult"],
    ["NE", "Nebraska", 4, 4, 1.96, "medical", "decriminalized"],
    ["MO", "Missouri", 4, 5, 6.15, "adult"],
    ["KY", "Kentucky", 4, 6, 4.51, "medical"],
    ["WV", "West Virginia", 4, 7, 1.79, "medical"],
    ["VA", "Virginia", 4, 8, 8.63, "adult"],
    ["MD", "Maryland", 4, 9, 6.18, "adult"],
    ["DE", "Delaware", 4, 10, 0.99, "adult"],
    ["AZ", "Arizona", 5, 2, 7.15, "adult"],
    ["NM", "New Mexico", 5, 3, 2.12, "adult"],
    ["KS", "Kansas", 5, 4, 2.94, "none"],
    ["AR", "Arkansas", 5, 5, 3.01, "medical"],
    ["TN", "Tennessee", 5, 6, 6.91, "cbd"],
    ["NC", "North Carolina", 5, 7, 10.4, "none", "decriminalized"],
    ["SC", "South Carolina", 5, 8, 5.12, "none"],
    ["DC", "Washington, D.C.", 5, 9, 0.69, "adult"],
    ["OK", "Oklahoma", 6, 4, 3.96, "medical"],
    ["LA", "Louisiana", 6, 5, 4.66, "medical", "decriminalized"],
    ["MS", "Mississippi", 6, 6, 2.96, "medical", "decriminalized"],
    ["AL", "Alabama", 6, 7, 5.02, "medical"],
    ["GA", "Georgia", 6, 8, 10.7, "cbd"],
    ["HI", "Hawaii", 7, 0, 1.46, "medical", "decriminalized"],
    ["TX", "Texas", 7, 4, 29.1, "cbd"],
    ["FL", "Florida", 7, 9, 21.5, "medical"]
  ];

  var STATES = S.map(function (r) {
    return { code: r[0], name: r[1], row: r[2], col: r[3], pop: r[4], cannabis: r[5], note: r[6] || "" };
  });
  var BY = {};
  STATES.forEach(function (s) { BY[s.code] = s; });

  window.NW_STATES = {
    list: STATES,
    by: BY,
    CANNABIS_AS_OF: "September 1, 2026",
    CANNABIS_SOURCE: { name: "DISA, Marijuana Legality by State", url: "https://disa.com/marijuana-legality-by-state/" },
    CANNABIS_LABELS: {
      adult: "Legal for adults",
      medical: "Medical only",
      cbd: "CBD / low-THC only",
      none: "Not legal"
    }
  };
})();
