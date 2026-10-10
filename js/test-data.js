// vanguard-data.js - Initial Civil Air Patrol Vanguard Catalog Seed Data

export const INITIAL_CAP_SUPPLY = [
  // --- INVENTORIED / IN SUPPLY SLOTS ---

{
  locationCode: "AA-01",
  location: "Section A, Hanger Row 1",
  title: "Short Sleeve Dress Shirt - Male",
  price: 62.25,
  categories: ["Hanging", "Blues", "Class A"],
  sizes: ["15.5 x 33", "16 x 34", "16.5 x 34"],
  status: "IN",
  vanguardUrl: "https://www.vanguardmil.com/...",
  image: "https://images.unsplash.com/..."
},
];

const rawInventory = [
  // --- GRADES & INSIGNIA ---
  { title: "C/Amn Grade", qty: 24, cat: ["Insignia", "Grades"], isOneSize: true },
  { title: "Gen J.F. Curry Achievement Ribbon (C/Amn)", qty: 13, cat: ["Ribbons, Cadet Program Awards/Achievements"], isOneSize: true },

  { title: "C/A1C Grade", qty: 22, cat: ["Insignia", "Grades"], isOneSize: true },
    { title: "Gen Hap Arnold Achievement Ribbon (C/A1C)", qty: 13, cat: ["Ribbons, Cadet Program Awards/Achievements"], isOneSize: true },

  { title: "C/SrA Grade", qty: 14, cat: ["Insignia", "Grades"], isOneSize: true },
    { title: "Mary Feik Achievement Ribbon (C/SrA)", qty: 5, cat: ["Ribbons, Cadet Program Awards/Achievements"], isOneSize: true },

  { title: "C/SSgt Grade", qty: 11, cat: ["Insignia", "Grades"], isOneSize: true },
    { title: "Wright Brothers Award Ribbon (C/SSgt)", qty: 9, cat: ["Ribbons, Cadet Program Awards/Achievements"], isOneSize: true },

  { title: "C/TSgt Grade", qty: 8, cat: ["Insignia", "Grades"], isOneSize: true },
    { title: "Capt Eddie Rickenbacker Achievement Ribbon (C/TSgt)", qty: 17, cat: ["Ribbons, Cadet Program Awards/Achievements"], isOneSize: true },

  { title: "C/MSgt Grade", stock: { "Standard": 9, "First Sergeant": 9 }, cat: ["Insignia", "Grades"] },
    { title: "Charles A. Lindbergh Achievement Ribbon (C/MSgt)", qty: 4, cat: ["Ribbons, Cadet Program Awards/Achievements"], isOneSize: true },

  { title: "C/SMSgt Grade", qty: 15, cat: ["Insignia", "Grades"], isOneSize: true },
    { title: "Gen Jimmy F. Doolittle Achievement Ribbon (C/SMSgt)", qty: 3, cat: ["Ribbons, Cadet Program Awards/Achievements"], isOneSize: true },

  { title: "C/CMSgt Grade", stock: { "Standard": 0, "First Sergeant": 14 }, cat: ["Insignia", "Grades"] },
    { title: "Dr. Robert H. Goddard Achievement Ribbon (C/CMSgt)", qty: 10, cat: ["Ribbons, Cadet Program Awards/Achievements"], isOneSize: true },
    { title: "Neil Armstrong Achievement Ribbon (C/CMSgt)", qty: 6, cat: ["Ribbons, Cadet Program Awards/Achievements"], isOneSize: true },

  { title: "C/2d Lt Grade", stock: { "Large": 8, "Cloth": 24, "Small": 8 }, cat: ["Insignia", "Grades"] },
    { title: "Gen Billy Mitchell Award Ribbon (C/2d Lt)", qty: 24, cat: ["Ribbons, Cadet Program Awards/Achievements"], isOneSize: true },

  { title: "C/1st Lt Grade", stock: { "Large": 11, "Cloth": 7, "Small": 12 }, cat: ["Insignia", "Grades"] },
  { title: "C/Capt Grade", stock: { "Large": 21, "Cloth": 9, "Small": 16 }, cat: ["Insignia", "Grades"] },
    { title: "Amelia Earhart Award Ribbon (C/Capt)", qty: 6, cat: ["Ribbons, Cadet Program Awards/Achievements"], isOneSize: true },

  { title: "C/Maj Grade", stock: { "Large": 12, "Cloth": 6, "Small": 19 }, cat: ["Insignia", "Grades"] },
  { title: "C/Lt Col Grade", stock: { "Large": 1, "Cloth": 4, "Small": 9 }, cat: ["Insignia", "Grades"] },
    { title: "Ira C. Eaker Award Ribbon (C/Lt Col)", qty: 6, cat: ["Ribbons, Cadet Program Awards/Achievements"], isOneSize: true },

  { title: "C/Col Grade", stock: { "Large": 3, "Cloth": 4, "Small": 3 }, cat: ["Insignia", "Grades"] },
    { title: "Gen Carl A. Spaatz Award Ribbon (C/Col)", qty: 6, cat: ["Ribbons, Cadet Program Awards/Achievements"], isOneSize: true },

  // --- SERVICE UNIFORMS & BLUES ACCOUTREMENTS ---
  { title: "Cadet Officer Epaulets Class A", qty: 4, cat: ["Blues", "Accoutrements"], isOneSize: true },
  { title: "Cadet Officer Service Uniform Class B (Male)", qty: 3, cat: ["Blues", "Uniforms"], isOneSize: true },
  { title: "Cadet Officer Service Uniform Class B (Female)", qty: 1, cat: ["Blues", "Uniforms"], isOneSize: true },
  { title: "Cadet Blues Nametag", stock: { "Blank": 3, "Lee": 2, "Laudolff": 1 }, cat: ["Blues", "Accoutrements"] },
  { title: "Blues Belt Buckle", qty: 2, cat: ["Blues", "Accoutrements"], isOneSize: true },
  { title: "Female Tie Tab", qty: 1, cat: ["Blues", "Accoutrements"], isOneSize: true },
  { title: "Blues Belt", qty: 2, cat: ["Blues", "Accoutrements"], isOneSize: true },
  { title: "Blues Shirt", qty: 65, cat: ["Blues", "Uniforms"], isOneSize: true },

  // --- SHOULDER CORDS & BOARDS ---
  { title: "Grey Shoulder Cord", qty: 4, cat: ["Accoutrements", "Cords"], isOneSize: true },
  { title: "White Shoulder Cord", qty: 4, cat: ["Accoutrements", "Cords"], isOneSize: true },
  { title: "Blue Shoulder Cord", qty: 1, cat: ["Accoutrements", "Cords"], isOneSize: true },
  { title: "Red Shoulder Cord", qty: 2, cat: ["Accoutrements", "Cords"], isOneSize: true },
  { title: "Mess Dress Shoulder Boards (Major)", qty: 1, cat: ["Mess Dress", "Insignia"], isOneSize: true },
  { title: "Mess Dress Shoulder Boards (Captain)", qty: 1, cat: ["Mess Dress", "Insignia"], isOneSize: true },
  { title: "Shoulder Board Holders (Male)", qty: 1, cat: ["Accoutrements"], isOneSize: true },
  { title: "Shoulder Board Holders (Female)", qty: 3, cat: ["Accoutrements"], isOneSize: true },

  // --- PATCHES & TAPES ---
  { title: "CAP Nametape (Velcro)", qty: 5, cat: ["Patches", "Tapes"], isOneSize: true },
  { title: "CAP Nametape", qty: 1, cat: ["Patches", "Tapes"], isOneSize: true },
  { title: "US Flag Patch (Velcro)", qty: 2, cat: ["Patches"], isOneSize: true },
  { title: "US Flag Patch", qty: 2, cat: ["Patches"], isOneSize: true },
  { title: "Reverse US Flag Patch", qty: 2, cat: ["Patches"], isOneSize: true },
  { title: "CAP Safety Patch", qty: 1, cat: ["Patches"], isOneSize: true },
  { title: "CAP Emblem Patch (Velcro)", qty: 1, cat: ["Patches"], isOneSize: true },
  { title: "MARC Flight Academy Patch", qty: 1, cat: ["Patches"], isOneSize: true },

  // --- HEADGEAR ---
  { title: "Male Senior Member Officer Flight Cap", qty: 10, cat: ["Headgear", "Blues"], isOneSize: true },
  { title: "Male Cadet Flight Cap", qty: 5, cat: ["Headgear", "Blues"], isOneSize: true },
  { title: "Female Cadet Flight Cap", qty: 3, cat: ["Headgear", "Blues"], isOneSize: true },
  { title: "Cadet Officer Service Cap", qty: 2, cat: ["Headgear", "Blues"], isOneSize: true },

  // --- UTILITY UNIFORMS (OCP / ABU / FDU) ---
  { title: "OCP/ABU Belt", qty: 9, cat: ["Utility", "Accoutrements"], isOneSize: true },
  { title: "OCP Cap", qty: 10, cat: ["Headgear", "OCP"], isOneSize: true },
  { title: "OCP Pants", qty: 12, cat: ["Utility", "OCP"], isOneSize: true },
  { title: "OCP Shirt", qty: 16, cat: ["Utility", "OCP"], isOneSize: true },
  { title: "Brown T-Shirt", qty: 6, cat: ["Utility", "Shirts"], isOneSize: true },
  { title: "ABU Shirt", qty: 63, cat: ["Utility", "ABU"], isOneSize: true },
  { title: "ABU Pants", qty: 66, cat: ["Utility", "ABU"], isOneSize: true },
  { title: "Flight Duty Uniform (FDU)", qty: 18, cat: ["Utility", "Flight Wear"], isOneSize: true },
  { title: "Flight Coat", qty: 2, cat: ["Outerwear", "Flight Wear"], isOneSize: true },
  { title: "Corporate Duty Flight Uniform", qty: 1, cat: ["Utility", "Flight Wear"], isOneSize: true },
  { title: "2PFDU OCP Pants", qty: 1, cat: ["Utility", "OCP"], isOneSize: true },
  { title: "ABU Fleece Jacket", qty: 2, cat: ["Outerwear", "ABU"], isOneSize: true },
  { title: "OCP Fleece Jacket", qty: 0, cat: ["Outerwear", "OCP"], isOneSize: true },
  { title: "ABU GORE-TEX Jacket", qty: 9, cat: ["Outerwear", "ABU"], isOneSize: true },
  { title: "OCP GORE-TEX Jacket", qty: 0, cat: ["Outerwear", "OCP"], isOneSize: true },

  // --- FOOTWEAR & ACCESSORIES ---
  { title: "Boot Blousers", qty: 8, cat: ["Accoutrements", "Footwear"], isOneSize: true },
  { title: "Green Socks", qty: 2, cat: ["Footwear", "Socks"], isOneSize: true },
  { title: "Brown Socks", qty: 1, cat: ["Footwear", "Socks"], isOneSize: true },
  { title: "OCP Boots", qty: 10, cat: ["Footwear", "Boots"], isOneSize: true },
  { title: "Black Boots", qty: 13, cat: ["Footwear", "Boots"], isOneSize: true },
  { title: "Black Dress Shoes", qty: 16, cat: ["Footwear", "Shoes"], isOneSize: true }
];