export type PaletteTag =
  | "Neon"
  | "Nature"
  | "Dark"
  | "Pastel"
  | "Historical"
  | "Vibrant"
  | "Monochrome"
  | "Warm"
  | "Cool"
  | "Light";

export interface PaletteDescriptor {
  name: string;
  colors: string[];
  tags: PaletteTag[];
}

export const PALETTES: PaletteDescriptor[] = [
  {
    name: "Interstellar",
    colors: ["#F5E6BE", "#D4AF37", "#5C4033", "#1A1A1A", "#000000"],
    tags: ["Warm", "Dark", "Vibrant"],
  },
  {
    name: "Tron Legacy",
    colors: ["#00E5FF", "#0081A7", "#121212", "#000000", "#FFFFFF"],
    tags: ["Neon", "Cool", "Dark"],
  },
  {
    name: "Mad Max",
    colors: ["#E76F51", "#F4A261", "#2A9D8F", "#264653", "#000000"],
    tags: ["Vibrant", "Warm", "Dark"],
  },
  {
    name: "The Martian",
    colors: ["#FF8C00", "#E34234", "#8B0000", "#4D0F0F", "#000000"],
    tags: ["Warm", "Nature", "Dark"],
  },
  {
    name: "Sin City",
    colors: ["#FFFFFF", "#D3D3D3", "#808080", "#2B2B2B", "#FF0000"],
    tags: ["Monochrome", "Dark", "Vibrant"],
  },
  {
    name: "The Grand Budapest",
    colors: ["#F497AD", "#FFD166", "#EF476F", "#A3C4BC", "#5E3023"],
    tags: ["Pastel", "Vibrant", "Warm"],
  },
  {
    name: "Marie Antoinette",
    colors: ["#FCE1E4", "#FCF4DD", "#DDEDEA", "#DAEAF6", "#E8DFF5"],
    tags: ["Pastel", "Light", "Historical"],
  },
  {
    name: "The Revenant",
    colors: ["#E0E0E0", "#A3B18A", "#588157", "#3A5A40", "#344E41"],
    tags: ["Nature", "Cool", "Dark"],
  },
  {
    name: "Oppenheimer",
    colors: ["#FFFFFF", "#C0C0C0", "#404040", "#1A1A1A", "#000000"],
    tags: ["Monochrome", "Historical", "Dark"],
  },
  {
    name: "Suspiria",
    colors: ["#FF0000", "#8B0000", "#4A0404", "#2E0854", "#000000"],
    tags: ["Vibrant", "Neon", "Dark"],
  },
  {
    name: "Hail Mary",
    colors: ["#F4FA1F", "#B4EC11", "#C28E15", "#688B21", "#1B3D0A"],
    tags: ["Neon", "Nature", "Vibrant"],
  },
  {
    name: "The Shimmer",
    colors: ["#9470BB", "#FF00FF", "#004B49", "#98FF98", "#2E1A47"],
    tags: ["Neon", "Nature", "Vibrant"],
  },
  {
    name: "Blade Runner 2049",
    colors: ["#FF5F00", "#E58E26", "#A52A2A", "#0A0A0A", "#00F3FF"],
    tags: ["Neon", "Nature", "Vibrant"],
  },
  {
    name: "Pandora Nights",
    colors: ["#00D2FF", "#002147", "#5D3FD3", "#32CD32", "#120A2A"],
    tags: ["Neon", "Nature", "Vibrant"],
  },
  {
    name: "Nostromo",
    colors: ["#050505", "#FF0000", "#4A4E52", "#C8AD7F", "#00FF41"],
    tags: ["Neon", "Nature", "Vibrant"],
  },
  {
    name: "Neon Sunset",
    colors: ["#0A0014", "#6600CC", "#FF206B", "#FF9500"],
    tags: ["Neon", "Warm", "Vibrant"],
  },
  {
    name: "Deep Ocean",
    colors: ["#001A2A", "#004466", "#0099BB", "#00FFCC"],
    tags: ["Nature", "Dark", "Cool"],
  },
  {
    name: "Midnight Ember",
    colors: ["#000000", "#4400CC", "#FF0044", "#FF6600"],
    tags: ["Dark", "Warm", "Vibrant"],
  },
  {
    name: "Aurora Pastel",
    colors: ["#E0CCFF", "#B399FF", "#8099FF", "#66DDEE"],
    tags: ["Pastel", "Cool", "Nature"],
  },
  {
    name: "Biohazard",
    colors: ["#000000", "#008000", "#00FF00", "#99FF00"],
    tags: ["Neon", "Dark", "Vibrant"],
  },
  {
    name: "Solar Forge",
    colors: ["#1A0A00", "#7A2E00", "#D4600A", "#F0A830"],
    tags: ["Warm", "Dark", "Vibrant"],
  },
  {
    name: "Boreal Forest",
    colors: ["#0A1A0A", "#1A4020", "#2D7A45", "#85C97A"],
    tags: ["Nature", "Dark", "Cool"],
  },
  {
    name: "Golden Hour",
    colors: ["#1A0A00", "#7A2E00", "#D4600A", "#F0A830", "#FFE8A0"],
    tags: ["Nature", "Warm", "Vibrant"],
  },
  {
    name: "Glacial Melt",
    colors: ["#001824", "#004466", "#0099BB", "#66DDEE", "#D4F5FF"],
    tags: ["Nature", "Cool", "Pastel"],
  },
  {
    name: "Volcanic Soil",
    colors: ["#0D0800", "#3A1500", "#7A3800", "#C46A1A", "#E8A050"],
    tags: ["Nature", "Dark", "Warm"],
  },
  {
    name: "Coral Reef",
    colors: ["#001833", "#005577", "#00AAAA", "#FF6644", "#FFCC44"],
    tags: ["Nature", "Vibrant", "Warm"],
  },
  {
    name: "Autumn Canopy",
    colors: ["#0D0800", "#6B2000", "#CC5500", "#E88020", "#F5C842"],
    tags: ["Nature", "Warm", "Vibrant"],
  },
  {
    name: "Desert Night",
    colors: ["#060410", "#1A1035", "#5544AA", "#CC8844", "#F0D090"],
    tags: ["Nature", "Dark", "Warm"],
  },
  {
    name: "Bioluminescent Bay",
    colors: ["#000A14", "#001A2A", "#003355", "#0066AA", "#00FFCC"],
    tags: ["Nature", "Neon", "Cool"],
  },
  {
    name: "Poison Dart Frog",
    colors: ["#050A00", "#1A6600", "#004488", "#FF4400", "#FFEE00"],
    tags: ["Nature", "Neon", "Vibrant"],
  },
  {
    name: "Sulfur Vents",
    colors: ["#000000", "#1A0033", "#660066", "#CCAA00", "#FFFFAA"],
    tags: ["Nature", "Dark", "Neon"],
  },
  {
    name: "Aurora Tundra",
    colors: ["#020818", "#004433", "#00AA55", "#AA00FF", "#FF66CC"],
    tags: ["Nature", "Cool", "Neon"],
  },
  {
    name: "Carnivorous Plant",
    colors: ["#001400", "#2D5A00", "#88AA00", "#CC3300", "#1A0022"],
    tags: ["Nature", "Dark", "Vibrant"],
  },
  {
    name: "Thunderhead",
    colors: ["#000511", "#0A1A44", "#334488", "#886600", "#FFDD44"],
    tags: ["Nature", "Dark", "Cool"],
  },
  {
    name: "Mantis Shrimp Vision",
    colors: ["#0A0022", "#6600CC", "#00CCAA", "#FFAA00", "#FF0066"],
    tags: ["Nature", "Neon", "Vibrant"],
  },
  {
    name: "Mycelium Network",
    colors: ["#060400", "#2A1800", "#664400", "#44AA66", "#CCFFAA"],
    tags: ["Nature", "Dark", "Warm"],
  },
  {
    name: "Cuttlefish Skin",
    colors: ["#0D0022", "#3300AA", "#0099CC", "#00CC88", "#FFCC00", "#FF3366"],
    tags: ["Nature", "Vibrant", "Cool"],
  },
  {
    name: "Blade Runner",
    colors: ["#000008", "#1A0030", "#CC0077", "#FF6600", "#FFDD00"],
    tags: ["Neon", "Dark", "Warm"],
  },
  {
    name: "Neural Mesh",
    colors: ["#000000", "#001122", "#003366", "#0099FF", "#00FFEE"],
    tags: ["Neon", "Dark", "Cool"],
  },
  {
    name: "Glitch Flesh",
    colors: ["#080000", "#440011", "#AA0044", "#00FFAA", "#FFFFFF"],
    tags: ["Neon", "Dark", "Warm"],
  },
  {
    name: "Orbital Decay",
    colors: ["#000005", "#050020", "#2200AA", "#FF4400", "#FFAA44"],
    tags: ["Dark", "Warm", "Vibrant"],
  },
  {
    name: "Vaporwave Core",
    colors: ["#0A001A", "#660066", "#CC44AA", "#44CCBB", "#AAFFEE"],
    tags: ["Pastel", "Neon", "Cool"],
  },
  {
    name: "Quantum Foam",
    colors: ["#000000", "#004400", "#00BB44", "#FFFF00", "#FF0099", "#000000"],
    tags: ["Neon", "Dark", "Vibrant"],
  },
  {
    name: "Synthetic Dusk",
    colors: ["#020010", "#110044", "#4400AA", "#CC6600", "#FFAA22"],
    tags: ["Dark", "Warm", "Vibrant"],
  },
  {
    name: "Zero Kelvin",
    colors: ["#000000", "#000A1A", "#001155", "#0044CC", "#88DDFF", "#FFFFFF"],
    tags: ["Dark", "Cool", "Monochrome"],
  },
  {
    name: "Infrared Pulse",
    colors: ["#000000", "#220022", "#880000", "#FF4400", "#FFCC00", "#FFFFFF"],
    tags: ["Dark", "Warm", "Vibrant"],
  },
  {
    name: "Neon Minimal",
    colors: ["#000000", "#050510", "#0A0A2A", "#001AFF", "#00EEFF"],
    tags: ["Neon", "Dark", "Cool"],
  },
  {
    name: "Acid Mesh",
    colors: ["#040010", "#2B0066", "#0044CC", "#00CC88", "#AAFF00"],
    tags: ["Neon", "Dark", "Vibrant"],
  },
  {
    name: "Deep OLED",
    colors: ["#000000", "#001133", "#003388", "#0077CC", "#00CCFF", "#88FFEE"],
    tags: ["Dark", "Cool", "Monochrome"],
  },
  {
    name: "Hyperreal Chrome",
    colors: ["#0A0A14", "#332244", "#886699", "#CCAADD", "#EEDDFF", "#FFFFFF"],
    tags: ["Pastel", "Cool", "Monochrome"],
  },
  {
    name: "Soft-Tech Pastel",
    colors: ["#0A1A1A", "#114433", "#228866", "#66DDAA", "#CCFFEE"],
    tags: ["Pastel", "Nature", "Cool"],
  },
  {
    name: "Cloud Dancer Abyss",
    colors: ["#050814", "#1A2244", "#446699", "#99BBCC", "#F0EEE9"],
    tags: ["Dark", "Cool", "Pastel"],
  },
  {
    name: "Sunwashed Depth",
    colors: ["#0A0800", "#3A2200", "#886644", "#CCAA77", "#F5E8CC"],
    tags: ["Warm", "Nature", "Pastel"],
  },
  {
    name: "Lysergic Bloom",
    colors: ["#FF00CC", "#FF6600", "#FFFF00", "#00FF66", "#0066FF", "#CC00FF"],
    tags: ["Neon", "Vibrant"],
  },
  {
    name: "Expired Film",
    colors: ["#220033", "#CC0066", "#FF9900", "#FFFF66", "#AAFFCC", "#EEFFFF"],
    tags: ["Warm", "Light", "Pastel"],
  },
  {
    name: "UV Wash",
    colors: ["#0A0010", "#4400CC", "#CC00FF", "#FF44DD", "#FFFFFF"],
    tags: ["Neon", "Cool", "Vibrant"],
  },
  {
    name: "Chromatic Bleed",
    colors: ["#FF0000", "#FF0066", "#AA00FF", "#0000FF", "#00FFFF", "#00FF44"],
    tags: ["Neon", "Vibrant"],
  },
  {
    name: "Mushroom Spore",
    colors: ["#110800", "#663300", "#CC6600", "#FF99CC", "#AADDFF", "#EEFFCC"],
    tags: ["Nature", "Warm", "Pastel"],
  },
  {
    name: "Overexposed",
    colors: [
      "#FF3300",
      "#FF6600",
      "#FFCC00",
      "#FFFFFF",
      "#AAFFEE",
      "#0099FF",
      "#0011CC",
    ],
    tags: ["Warm", "Vibrant", "Light"],
  },
  {
    name: "Synesthetic Pulse",
    colors: [
      "#000000",
      "#440044",
      "#FF00AA",
      "#FFFF00",
      "#00FFCC",
      "#004488",
      "#000000",
    ],
    tags: ["Neon", "Dark", "Vibrant"],
  },
  {
    name: "Candy Burn",
    colors: ["#FF0055", "#FF44AA", "#FF88FF", "#FFFF99", "#AAFF88", "#44FFDD"],
    tags: ["Neon", "Pastel", "Warm"],
  },
  {
    name: "Paeonia",
    colors: ["#1A0008", "#660022", "#CC2255", "#FF88AA", "#FFE0EC"],
    tags: ["Nature", "Warm", "Pastel"],
  },
  {
    name: "Night Orchid",
    colors: ["#050008", "#220033", "#660077", "#CC44BB", "#FFAAEE"],
    tags: ["Nature", "Dark", "Cool"],
  },
  {
    name: "Sunflower Field",
    colors: ["#0D0800", "#4A2200", "#AA6600", "#FFCC00", "#FFF0AA", "#FFFDE8"],
    tags: ["Nature", "Warm", "Vibrant"],
  },
  {
    name: "Wisteria Rain",
    colors: ["#080614", "#2A1A55", "#7755BB", "#BBAADD", "#F0EEFF"],
    tags: ["Nature", "Cool", "Pastel"],
  },
  {
    name: "Poppy Field",
    colors: ["#020800", "#0A2200", "#224400", "#CC1100", "#FF4422", "#FFCC88"],
    tags: ["Nature", "Warm", "Vibrant"],
  },
  {
    name: "Cherry Blossom Dusk",
    colors: ["#060414", "#1A0A44", "#662277", "#EE88BB", "#FFD6E8", "#FFF8FB"],
    tags: ["Nature", "Dark", "Pastel"],
  },
  {
    name: "Bird of Paradise",
    colors: ["#000A1A", "#003366", "#0066CC", "#FF7700", "#FFCC22"],
    tags: ["Nature", "Vibrant", "Warm"],
  },
  {
    name: "Violet After Rain",
    colors: ["#080C10", "#1A2233", "#334466", "#7766AA", "#CCBBDD", "#F5F0FF"],
    tags: ["Nature", "Dark", "Cool"],
  },
  {
    name: "Dahlia Ink",
    colors: ["#050005", "#330022", "#880044", "#DD2266", "#FF6644", "#FFAA66"],
    tags: ["Nature", "Dark", "Warm"],
  },
  {
    name: "Lavender Haze",
    colors: ["#0A0814", "#2A1A44", "#664488", "#BB99CC", "#E8DDFF", "#F8F5FF"],
    tags: ["Nature", "Pastel", "Cool"],
  },
  {
    name: "Illuminated Manuscript",
    colors: ["#080610", "#1A1044", "#1A4488", "#CC9900", "#F5D060", "#FDF5D0"],
    tags: ["Historical", "Warm", "Dark"],
  },
  {
    name: "Dragon's Blood",
    colors: ["#050000", "#2A0000", "#880000", "#CC2200", "#FF6622", "#FFAA44"],
    tags: ["Historical", "Dark", "Warm"],
  },
  {
    name: "Crusader Dusk",
    colors: ["#060410", "#220A00", "#885522", "#DDAA44", "#F0D898", "#EEF4FF"],
    tags: ["Historical", "Nature", "Warm"],
  },
  {
    name: "Poisoned Chalice",
    colors: ["#000000", "#001100", "#005522", "#00AA44", "#88FF44", "#DDFF99"],
    tags: ["Historical", "Dark", "Neon"],
  },
  {
    name: "Royal Throne",
    colors: ["#020004", "#1A0033", "#550088", "#9900CC", "#DD88FF", "#F8EEFF"],
    tags: ["Historical", "Dark", "Cool"],
  },
  {
    name: "Iron & Ember",
    colors: [
      "#000000",
      "#111111",
      "#332200",
      "#884400",
      "#DD6600",
      "#FFAA22",
      "#FFEEAA",
    ],
    tags: ["Historical", "Dark", "Warm"],
  },
  {
    name: "Plague Doctor",
    colors: [
      "#040400",
      "#1A1800",
      "#554400",
      "#998800",
      "#CCBB00",
      "#EEDD44",
      "#110800",
    ],
    tags: ["Historical", "Dark", "Warm"],
  },
  {
    name: "Cathedral Glass",
    colors: [
      "#040210",
      "#220044",
      "#0044AA",
      "#00AA66",
      "#DD8800",
      "#CC2200",
      "#440011",
    ],
    tags: ["Historical", "Dark", "Vibrant"],
  },
  {
    name: "Moorish Tile",
    colors: ["#080600", "#3A1A00", "#884422", "#0088AA", "#00CCBB", "#AAFFEE"],
    tags: ["Historical", "Warm", "Cool"],
  },
  {
    name: "Monk's Candlelight",
    colors: ["#000000", "#0A0600", "#2A1400", "#7A4400", "#CC8833", "#F5CC88"],
    tags: ["Historical", "Dark", "Warm"],
  },
  {
    name: "Ghibli Clouds",
    colors: ["#1CA3EC", "#FFFFFF", "#FFFDF4", "#8B9BB4"],
    tags: ["Nature", "Pastel", "Light"],
  },
  {
    name: "Plasma Core",
    colors: ["#000000", "#0A0033", "#5500BB", "#CC0044", "#FF4400", "#E0FFFF"],
    tags: ["Dark", "Neon", "Vibrant"],
  },
];
