/**
 * Authoritative AICP 2023 bid-form template, extracted from the official AICP
 * bid form (AICP_bidform_2023_update.xlsm). This is the seed structure a new
 * AICP bid starts from: the lettered cost categories A–X in canonical order,
 * their display names, whether each carries labor fringes / a handling fee, the
 * production-vs-post roll-up group, and the standard default line items for
 * each (with their canonical AICP line number and unit type). Users add/rename/
 * hide lines from here; the production categories (A–N) carry the fixed AICP #s
 * (1–273) that timecards, POs and invoices code costs back to, while the post
 * sections (Q–X) have none on the standard form.
 *
 * Categories A–K roll into the production sub-total (subject to Production Fee &
 * Insurance per the section matrix); L/M/N/O are added below that; Q–X are the
 * post-production group (own insurance/markup/tax). X (and the P breakouts) hold
 * named sub-sections rather than a flat line list.
 */

export type AicpCategoryKind = "labor" | "expense" | "talent";
export type AicpGroup = "production" | "post";

export interface AicpTemplateLine {
  /** Canonical AICP line number (e.g. "7"); empty for sections without one. */
  no: string;
  title: string;
  unitType: string;
}

export interface AicpTemplateCategory {
  letter: string;
  name: string;
  kind: AicpCategoryKind;
  group: AicpGroup;
  /** Carries labor fringes (applied to this category subtotal). */
  fringes: boolean;
  /** Carries a talent handling fee. */
  handling: boolean;
  /** Holds named sub-sections (e.g. X / P breakouts) instead of a flat list. */
  subSections: boolean;
  lines: AicpTemplateLine[];
}

export const AICP_TEMPLATE_VERSION = "AICP 2023";

export const AICP_TEMPLATE: AicpTemplateCategory[] = [
  {
    "letter": "A",
    "name": "Prep Crew",
    "kind": "labor",
    "group": "production",
    "fringes": true,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "1",
        "title": "Line Producer",
        "unitType": "days"
      },
      {
        "no": "2",
        "title": "Assistant Director",
        "unitType": "days"
      },
      {
        "no": "3",
        "title": "Director of Photography",
        "unitType": "days"
      },
      {
        "no": "4",
        "title": "1st Assistant Camera",
        "unitType": "days"
      },
      {
        "no": "5",
        "title": "2nd Assistant Camera",
        "unitType": "days"
      },
      {
        "no": "6",
        "title": "DIT",
        "unitType": "days"
      },
      {
        "no": "7",
        "title": "Prop Master",
        "unitType": "days"
      },
      {
        "no": "8",
        "title": "Asst Props",
        "unitType": "days"
      },
      {
        "no": "10",
        "title": "Camera Op",
        "unitType": "days"
      },
      {
        "no": "11",
        "title": "Gaffer",
        "unitType": "days"
      },
      {
        "no": "12",
        "title": "Best Boy Electric",
        "unitType": "days"
      },
      {
        "no": "13",
        "title": "3rd Electric",
        "unitType": "days"
      },
      {
        "no": "14",
        "title": "Electric/Driver",
        "unitType": "days"
      },
      {
        "no": "15",
        "title": "Prep/Strike/Pre Rig Crew",
        "unitType": "days"
      },
      {
        "no": "16",
        "title": "Key Grip",
        "unitType": "days"
      },
      {
        "no": "17",
        "title": "Best Boy Grip",
        "unitType": "days"
      },
      {
        "no": "18",
        "title": "3rd Grip",
        "unitType": "days"
      },
      {
        "no": "19",
        "title": "Grip/Driver",
        "unitType": "days"
      },
      {
        "no": "20",
        "title": "Crane Tech 2x",
        "unitType": "days"
      },
      {
        "no": "21",
        "title": "Crane Head Tech",
        "unitType": "days"
      },
      {
        "no": "22",
        "title": "Steadi Cam Op",
        "unitType": "days"
      },
      {
        "no": "23",
        "title": "Choreographer",
        "unitType": "days"
      },
      {
        "no": "24",
        "title": "Make-Up/Hair",
        "unitType": "days"
      },
      {
        "no": "25",
        "title": "Make-Up/Hair Asst",
        "unitType": "days"
      },
      {
        "no": "26",
        "title": "Wardrobe Stylist",
        "unitType": "days"
      },
      {
        "no": "27",
        "title": "Asst Wardrobe",
        "unitType": "days"
      },
      {
        "no": "28",
        "title": "Script Supervisor",
        "unitType": "days"
      },
      {
        "no": "29",
        "title": "Boom Operator",
        "unitType": "days"
      },
      {
        "no": "30",
        "title": "Sound Mixer",
        "unitType": "days"
      },
      {
        "no": "31",
        "title": "VTR Operator",
        "unitType": "days"
      },
      {
        "no": "32",
        "title": "Stunt Coordinator",
        "unitType": "days"
      },
      {
        "no": "33",
        "title": "Safety Officer",
        "unitType": "days"
      },
      {
        "no": "34",
        "title": "Site Rep",
        "unitType": "days"
      },
      {
        "no": "35",
        "title": "Storyboard Artist",
        "unitType": "days"
      },
      {
        "no": "36",
        "title": "Catering Crew",
        "unitType": "days"
      },
      {
        "no": "37",
        "title": "Location Scout",
        "unitType": "days"
      },
      {
        "no": "38",
        "title": "Compliance Assistant",
        "unitType": "days"
      },
      {
        "no": "39",
        "title": "2nd AD",
        "unitType": "days"
      },
      {
        "no": "40",
        "title": "Medic",
        "unitType": "days"
      },
      {
        "no": "41",
        "title": "Craft Service",
        "unitType": "days"
      },
      {
        "no": "42",
        "title": "Firefighter",
        "unitType": "days"
      },
      {
        "no": "43",
        "title": "Police Officers/Ranger/CHP",
        "unitType": "days"
      },
      {
        "no": "44",
        "title": "Welfare/Teacher",
        "unitType": "days"
      },
      {
        "no": "45",
        "title": "Gang Boss",
        "unitType": "days"
      },
      {
        "no": "46",
        "title": "Teamster Drivers / Animal Wranglers",
        "unitType": "days"
      },
      {
        "no": "47",
        "title": "Production Supervisor",
        "unitType": "days"
      },
      {
        "no": "48",
        "title": "Assistant Production Supervisor",
        "unitType": "days"
      },
      {
        "no": "49",
        "title": "Production Assistant",
        "unitType": "days"
      }
    ]
  },
  {
    "letter": "B",
    "name": "Shoot Crew",
    "kind": "labor",
    "group": "production",
    "fringes": true,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "51",
        "title": "Line Producer",
        "unitType": "days"
      },
      {
        "no": "52",
        "title": "Assistant Director",
        "unitType": "days"
      },
      {
        "no": "53",
        "title": "Director of Photography",
        "unitType": "days"
      },
      {
        "no": "54",
        "title": "1st Assistant Camera",
        "unitType": "days"
      },
      {
        "no": "55",
        "title": "2nd Assistant Camera",
        "unitType": "days"
      },
      {
        "no": "56",
        "title": "DIT",
        "unitType": "days"
      },
      {
        "no": "57",
        "title": "Prop Master",
        "unitType": "days"
      },
      {
        "no": "58",
        "title": "Asst Props",
        "unitType": "days"
      },
      {
        "no": "60",
        "title": "Camera Op",
        "unitType": "days"
      },
      {
        "no": "61",
        "title": "Gaffer",
        "unitType": "days"
      },
      {
        "no": "62",
        "title": "Best Boy Electric",
        "unitType": "days"
      },
      {
        "no": "63",
        "title": "3rd Electric",
        "unitType": "days"
      },
      {
        "no": "64",
        "title": "Electric/Driver",
        "unitType": "days"
      },
      {
        "no": "65",
        "title": "Prep/Strike/Pre Rig Crew",
        "unitType": "days"
      },
      {
        "no": "66",
        "title": "Key Grip",
        "unitType": "days"
      },
      {
        "no": "67",
        "title": "Best Boy Grip",
        "unitType": "days"
      },
      {
        "no": "68",
        "title": "3rd Grip",
        "unitType": "days"
      },
      {
        "no": "69",
        "title": "Grip/Driver",
        "unitType": "days"
      },
      {
        "no": "70",
        "title": "Crane Tech 2x",
        "unitType": "days"
      },
      {
        "no": "71",
        "title": "Crane Head Tech",
        "unitType": "days"
      },
      {
        "no": "72",
        "title": "Steadi Cam Op",
        "unitType": "days"
      },
      {
        "no": "73",
        "title": "Choreographer",
        "unitType": "days"
      },
      {
        "no": "74",
        "title": "Make-Up/Hair",
        "unitType": "days"
      },
      {
        "no": "75",
        "title": "Make-Up/Hair Asst",
        "unitType": "days"
      },
      {
        "no": "76",
        "title": "Wardrobe Stylist",
        "unitType": "days"
      },
      {
        "no": "77",
        "title": "Asst Wardrobe",
        "unitType": "days"
      },
      {
        "no": "78",
        "title": "Script Supervisor",
        "unitType": "days"
      },
      {
        "no": "79",
        "title": "Boom Operator",
        "unitType": "days"
      },
      {
        "no": "80",
        "title": "Sound Mixer",
        "unitType": "days"
      },
      {
        "no": "81",
        "title": "VTR Operator",
        "unitType": "days"
      },
      {
        "no": "82",
        "title": "Stunt Coordinator",
        "unitType": "days"
      },
      {
        "no": "83",
        "title": "Safety Officer",
        "unitType": "days"
      },
      {
        "no": "84",
        "title": "Site Rep",
        "unitType": "days"
      },
      {
        "no": "85",
        "title": "Storyboard Artist",
        "unitType": "days"
      },
      {
        "no": "86",
        "title": "Catering Crew",
        "unitType": "days"
      },
      {
        "no": "87",
        "title": "Location Manager",
        "unitType": "days"
      },
      {
        "no": "88",
        "title": "Compliance Assistant",
        "unitType": "days"
      },
      {
        "no": "89",
        "title": "2nd AD",
        "unitType": "days"
      },
      {
        "no": "90",
        "title": "Medic",
        "unitType": "days"
      },
      {
        "no": "91",
        "title": "Craft Service",
        "unitType": "days"
      },
      {
        "no": "92",
        "title": "Firefighter",
        "unitType": "days"
      },
      {
        "no": "93",
        "title": "Police Officers/Ranger/CHP",
        "unitType": "days"
      },
      {
        "no": "94",
        "title": "Welfare/Teacher",
        "unitType": "days"
      },
      {
        "no": "95",
        "title": "Gang Boss",
        "unitType": "days"
      },
      {
        "no": "96",
        "title": "Teamster Drivers / Animal Wranglers",
        "unitType": "days"
      },
      {
        "no": "97",
        "title": "Production Supervisor",
        "unitType": "days"
      },
      {
        "no": "98",
        "title": "Assistant Production Supervisor",
        "unitType": "days"
      },
      {
        "no": "99",
        "title": "Production Assistant",
        "unitType": "days"
      }
    ]
  },
  {
    "letter": "C",
    "name": "Prep & Wrap Expenses",
    "kind": "expense",
    "group": "production",
    "fringes": false,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "101",
        "title": "Craft Service",
        "unitType": "each"
      },
      {
        "no": "102",
        "title": "Per Diems",
        "unitType": "each"
      },
      {
        "no": "103",
        "title": "Hotels",
        "unitType": "each"
      },
      {
        "no": "104",
        "title": "Scouting Expenses",
        "unitType": "each"
      },
      {
        "no": "105",
        "title": "Deliveries & Taxi",
        "unitType": "allow"
      },
      {
        "no": "106",
        "title": "Car Rental",
        "unitType": "each"
      },
      {
        "no": "107",
        "title": "Trucking",
        "unitType": "each"
      },
      {
        "no": "108",
        "title": "Casting Director",
        "unitType": "days"
      },
      {
        "no": "109",
        "title": "Casting Facility",
        "unitType": "days"
      },
      {
        "no": "110",
        "title": "Home Econ Supplies",
        "unitType": "each"
      },
      {
        "no": "111",
        "title": "Telephone & Cable",
        "unitType": "each"
      },
      {
        "no": "112",
        "title": "Working Meals",
        "unitType": "each"
      },
      {
        "no": "113",
        "title": "Messengers",
        "unitType": "each"
      }
    ]
  },
  {
    "letter": "D",
    "name": "Location Expenses",
    "kind": "expense",
    "group": "production",
    "fringes": false,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "114",
        "title": "Location Fees",
        "unitType": "each"
      },
      {
        "no": "115",
        "title": "Permits",
        "unitType": "each"
      },
      {
        "no": "116",
        "title": "Lane Closures",
        "unitType": "each"
      },
      {
        "no": "117",
        "title": "Set Security",
        "unitType": "each"
      },
      {
        "no": "118",
        "title": "Cargo Van",
        "unitType": "each"
      },
      {
        "no": "119",
        "title": "Production Trucking",
        "unitType": "each"
      },
      {
        "no": "120",
        "title": "Camera Truck",
        "unitType": "each"
      },
      {
        "no": "121",
        "title": "Car Rentals",
        "unitType": "each"
      },
      {
        "no": "122",
        "title": "Bus Rentals",
        "unitType": "each"
      },
      {
        "no": "123",
        "title": "Limousines",
        "unitType": "each"
      },
      {
        "no": "124",
        "title": "Dressing Room Vehicles",
        "unitType": "each"
      },
      {
        "no": "125",
        "title": "Production MoHo",
        "unitType": "each"
      },
      {
        "no": "126",
        "title": "Other Vehicles",
        "unitType": "each"
      },
      {
        "no": "127",
        "title": "Parking/Tolls/Gas",
        "unitType": "each"
      },
      {
        "no": "128",
        "title": "Excess Bags/Homeland Security",
        "unitType": "each"
      },
      {
        "no": "129",
        "title": "Air Fares",
        "unitType": "each"
      },
      {
        "no": "130",
        "title": "Hotels",
        "unitType": "each"
      },
      {
        "no": "131",
        "title": "Per Diems",
        "unitType": "each"
      },
      {
        "no": "132",
        "title": "Talent Meals",
        "unitType": "each"
      },
      {
        "no": "133",
        "title": "Breakfast",
        "unitType": "ppl"
      },
      {
        "no": "134",
        "title": "Lunch",
        "unitType": "ppl"
      },
      {
        "no": "135",
        "title": "Dinner",
        "unitType": "ppl"
      },
      {
        "no": "136",
        "title": "Cabs/ Ubers/ Lyfts / Other Transportation",
        "unitType": "each"
      },
      {
        "no": "137",
        "title": "Kit Rental",
        "unitType": "each"
      },
      {
        "no": "138",
        "title": "Art Work",
        "unitType": "each"
      },
      {
        "no": "139",
        "title": "Sustainable Practices",
        "unitType": "allow"
      }
    ]
  },
  {
    "letter": "E",
    "name": "Props, Wardrobe & Animals",
    "kind": "expense",
    "group": "production",
    "fringes": false,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "140",
        "title": "Prop Rental",
        "unitType": "each"
      },
      {
        "no": "141",
        "title": "Prop Purchase",
        "unitType": "each"
      },
      {
        "no": "142",
        "title": "Prop Fabrication",
        "unitType": "each"
      },
      {
        "no": "143",
        "title": "Wardrobe Rental",
        "unitType": "each"
      },
      {
        "no": "144",
        "title": "Wardrobe Purchase",
        "unitType": "each"
      },
      {
        "no": "145",
        "title": "Costumes",
        "unitType": "each"
      },
      {
        "no": "146",
        "title": "Picture Vehicles",
        "unitType": "each"
      },
      {
        "no": "147",
        "title": "Animals & Handlers",
        "unitType": "each"
      },
      {
        "no": "148",
        "title": "Theatrical Makeup",
        "unitType": "each"
      },
      {
        "no": "149",
        "title": "Product Prep / Color Correct",
        "unitType": "each"
      },
      {
        "no": "150",
        "title": "Greens",
        "unitType": "each"
      }
    ]
  },
  {
    "letter": "F",
    "name": "Studio Costs",
    "kind": "expense",
    "group": "production",
    "fringes": false,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "151",
        "title": "Rental For Build Days",
        "unitType": "days"
      },
      {
        "no": "152",
        "title": "Build OT Hours",
        "unitType": "hrs"
      },
      {
        "no": "153",
        "title": "Rental for Pre-Lite Days",
        "unitType": "days"
      },
      {
        "no": "154",
        "title": "Pre-Lite OT Hours",
        "unitType": "days"
      },
      {
        "no": "155",
        "title": "Rental for Shoot Days",
        "unitType": "days"
      },
      {
        "no": "156",
        "title": "Shoot OT Hours",
        "unitType": "hrs"
      },
      {
        "no": "157",
        "title": "Rental for Strike Days",
        "unitType": "days"
      },
      {
        "no": "158",
        "title": "Strike OT Hours",
        "unitType": "hrs"
      },
      {
        "no": "159",
        "title": "Generator and Operator",
        "unitType": "days"
      },
      {
        "no": "160",
        "title": "Stage Manager/Studio Security",
        "unitType": "days"
      },
      {
        "no": "161",
        "title": "Power Charges",
        "unitType": "days"
      },
      {
        "no": "162",
        "title": "Misc Studio Charges",
        "unitType": "days"
      },
      {
        "no": "163",
        "title": "Meals for Crew & Talent",
        "unitType": "days"
      },
      {
        "no": "164",
        "title": "Air Conditioning",
        "unitType": "days"
      },
      {
        "no": "165",
        "title": "Crew Parking",
        "unitType": "days"
      },
      {
        "no": "166",
        "title": "Condor/Scissor Lift",
        "unitType": "days"
      },
      {
        "no": "167",
        "title": "Steeldeck",
        "unitType": "days"
      }
    ]
  },
  {
    "letter": "G",
    "name": "Art Department Labor",
    "kind": "labor",
    "group": "production",
    "fringes": true,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "168",
        "title": "Production Designer/Art Director",
        "unitType": "days"
      },
      {
        "no": "170",
        "title": "Set Decorator",
        "unitType": "days"
      },
      {
        "no": "171",
        "title": "Art Dept Coordinator",
        "unitType": "days"
      },
      {
        "no": "172",
        "title": "Prop Master",
        "unitType": "days"
      },
      {
        "no": "173",
        "title": "Asst Props",
        "unitType": "days"
      },
      {
        "no": "174",
        "title": "Swing",
        "unitType": "days"
      },
      {
        "no": "175",
        "title": "Leadman",
        "unitType": "days"
      },
      {
        "no": "176",
        "title": "Set Dresser",
        "unitType": "days"
      },
      {
        "no": "177",
        "title": "Scenics",
        "unitType": "days"
      },
      {
        "no": "178",
        "title": "Grips / Riggers",
        "unitType": "days"
      }
    ]
  },
  {
    "letter": "H",
    "name": "Art Department Expenses",
    "kind": "expense",
    "group": "production",
    "fringes": false,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "181",
        "title": "Set Dressing Rentals",
        "unitType": "each"
      },
      {
        "no": "182",
        "title": "Set Dressing Purchases",
        "unitType": "each"
      },
      {
        "no": "183",
        "title": "Art Dept Prod Supplies",
        "unitType": "each"
      },
      {
        "no": "184",
        "title": "Art Dept Kit Rental",
        "unitType": "each"
      },
      {
        "no": "185",
        "title": "Special Effects Rental",
        "unitType": "each"
      },
      {
        "no": "186",
        "title": "Art Dept Trucking",
        "unitType": "each"
      },
      {
        "no": "187",
        "title": "Outside Construction",
        "unitType": "each"
      },
      {
        "no": "188",
        "title": "Car Prep",
        "unitType": "each"
      },
      {
        "no": "189",
        "title": "Art Dept Meals",
        "unitType": "each"
      },
      {
        "no": "190",
        "title": "Messengers/Deliveries",
        "unitType": "each"
      }
    ]
  },
  {
    "letter": "I",
    "name": "Equipment Rental",
    "kind": "expense",
    "group": "production",
    "fringes": false,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "193",
        "title": "Camera Rental",
        "unitType": "days"
      },
      {
        "no": "194",
        "title": "Sound Rental",
        "unitType": "days"
      },
      {
        "no": "195",
        "title": "Lighting Rental",
        "unitType": "days"
      },
      {
        "no": "196",
        "title": "Grip Rental",
        "unitType": "days"
      },
      {
        "no": "197",
        "title": "Generator Rental",
        "unitType": "days"
      },
      {
        "no": "198",
        "title": "Crane Rental",
        "unitType": "days"
      },
      {
        "no": "199",
        "title": "VTR Rental",
        "unitType": "days"
      },
      {
        "no": "200",
        "title": "Walkie Talkie Rental",
        "unitType": "days"
      },
      {
        "no": "201",
        "title": "Dolly Rental",
        "unitType": "days"
      },
      {
        "no": "202",
        "title": "SteadiCam",
        "unitType": "days"
      },
      {
        "no": "203",
        "title": "Helicopter",
        "unitType": "days"
      },
      {
        "no": "204",
        "title": "Production Supplies",
        "unitType": "days"
      },
      {
        "no": "205",
        "title": "Jib Arm",
        "unitType": "days"
      },
      {
        "no": "206",
        "title": "Crane Head",
        "unitType": "days"
      },
      {
        "no": "207",
        "title": "Camera Car",
        "unitType": "days"
      },
      {
        "no": "208",
        "title": "Expendables",
        "unitType": "days"
      },
      {
        "no": "209",
        "title": "Lenses",
        "unitType": "days"
      },
      {
        "no": "210",
        "title": "Cinedrives",
        "unitType": "days"
      }
    ]
  },
  {
    "letter": "J",
    "name": "Media",
    "kind": "expense",
    "group": "production",
    "fringes": false,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "211",
        "title": "Media / Drives",
        "unitType": "each"
      },
      {
        "no": "212",
        "title": "Film",
        "unitType": "ft"
      },
      {
        "no": "213",
        "title": "Transcode / Transfer",
        "unitType": "hrs"
      },
      {
        "no": "214",
        "title": "Process",
        "unitType": "hrs"
      },
      {
        "no": "215",
        "title": "Dailies",
        "unitType": "each"
      }
    ]
  },
  {
    "letter": "K",
    "name": "Miscellaneous Production Costs",
    "kind": "expense",
    "group": "production",
    "fringes": false,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "217",
        "title": "Petty Cash",
        "unitType": "each"
      },
      {
        "no": "218",
        "title": "Air Shipping and Carriers",
        "unitType": "each"
      },
      {
        "no": "219",
        "title": "Phones and Cables",
        "unitType": "each"
      },
      {
        "no": "220",
        "title": "Cash Under $15 Each",
        "unitType": "each"
      },
      {
        "no": "221",
        "title": "External Billing Costs",
        "unitType": "each"
      },
      {
        "no": "222",
        "title": "Special Insurance",
        "unitType": "each"
      },
      {
        "no": "223",
        "title": "Cell Phones",
        "unitType": "each"
      },
      {
        "no": "224",
        "title": "Foreign Production Service Co",
        "unitType": "each"
      }
    ]
  },
  {
    "letter": "L",
    "name": "Director's Fees",
    "kind": "labor",
    "group": "production",
    "fringes": true,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "227",
        "title": "Director Prep",
        "unitType": "days"
      },
      {
        "no": "228",
        "title": "Director Travel",
        "unitType": "days"
      },
      {
        "no": "229",
        "title": "Director Shoot",
        "unitType": "days"
      },
      {
        "no": "230",
        "title": "Director Post",
        "unitType": "days"
      },
      {
        "no": "231",
        "title": "Fringes",
        "unitType": "days"
      }
    ]
  },
  {
    "letter": "M",
    "name": "Talent",
    "kind": "talent",
    "group": "production",
    "fringes": true,
    "handling": true,
    "subSections": false,
    "lines": [
      {
        "no": "234",
        "title": "O/C Principals",
        "unitType": "days"
      },
      {
        "no": "244",
        "title": "Office Extras",
        "unitType": "days"
      },
      {
        "no": "246",
        "title": "Crowd Extras",
        "unitType": "days"
      },
      {
        "no": "247",
        "title": "General Extras",
        "unitType": "days"
      },
      {
        "no": "255",
        "title": "Hand Models",
        "unitType": "days"
      },
      {
        "no": "258",
        "title": "Voice Over",
        "unitType": "days"
      },
      {
        "no": "259",
        "title": "Fitting Fees",
        "unitType": "days"
      },
      {
        "no": "262",
        "title": "Audition Fees",
        "unitType": "days"
      },
      {
        "no": "266",
        "title": "Talent Agency Fees",
        "unitType": "each"
      },
      {
        "no": "267",
        "title": "Talent Payroll Service",
        "unitType": "each"
      },
      {
        "no": "268",
        "title": "Talent Wardrobe Allowance",
        "unitType": "each"
      }
    ]
  },
  {
    "letter": "N",
    "name": "Talent Expenses",
    "kind": "expense",
    "group": "production",
    "fringes": false,
    "handling": true,
    "subSections": false,
    "lines": [
      {
        "no": "271",
        "title": "Talent Air Fares",
        "unitType": "each"
      },
      {
        "no": "272",
        "title": "Talent Per Diem",
        "unitType": "each"
      },
      {
        "no": "273",
        "title": "Talent Gd Transportation",
        "unitType": "each"
      }
    ]
  },
  {
    "letter": "O",
    "name": "Other",
    "kind": "expense",
    "group": "production",
    "fringes": false,
    "handling": true,
    "subSections": false,
    "lines": []
  },
  {
    "letter": "Q",
    "name": "Editorial",
    "kind": "expense",
    "group": "post",
    "fringes": false,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "",
        "title": "File Conversion & Transcoding",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Breakdown",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Stock Footage Search",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Digital Dalies Transfer",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Transcription / Translation",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Offline Edit System",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Off-Line Graphics System",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Data Backup / Restore",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Conform",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Hi-Res Conform",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Mix Prep",
        "unitType": "flat"
      },
      {
        "no": "",
        "title": "Color Prep",
        "unitType": "flat"
      },
      {
        "no": "",
        "title": "Conform Prep",
        "unitType": "flat"
      },
      {
        "no": "",
        "title": "Graphics Prep",
        "unitType": "flat"
      },
      {
        "no": "",
        "title": "Remote Off-Line Edit Suite",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Digital Media",
        "unitType": "flat"
      },
      {
        "no": "",
        "title": "Offline Posting",
        "unitType": "flat"
      },
      {
        "no": "",
        "title": "Backup /  Restore",
        "unitType": "flat"
      },
      {
        "no": "",
        "title": "Archiving",
        "unitType": "flat"
      }
    ]
  },
  {
    "letter": "R",
    "name": "Social Versions",
    "kind": "expense",
    "group": "post",
    "fringes": false,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "",
        "title": "Aditional Cleanup",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Re-position / Re-composite",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Re-animate",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Frame Extension",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Pre-Roll Versions",
        "unitType": "flat"
      },
      {
        "no": "",
        "title": "Additional Grading",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "File Versioning / Compression",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Reformatting 1 x 1",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Reformatting 9 x 16",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Reformatting 4 x 3",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Reformatting 5 x 4",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Reframing 1 x 1",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Reframing  9 x 16",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Reframing  4 x 3",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Reframing  5 x 4",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Social mixes",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Social Music Edits",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Additional VO Record",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Additional Drives",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Postings / Digital Delivery / QC",
        "unitType": "allow"
      }
    ]
  },
  {
    "letter": "S",
    "name": "Audio",
    "kind": "expense",
    "group": "post",
    "fringes": false,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "",
        "title": "Pre-Load, Encode and Mix Prep",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Sound Effects / Music Search",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Voice Casting",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Transcription / Translation",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "VO Record",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "ADR",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "5.1 Mix",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Other Format Mixing",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Record and Mix",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Scratch Record",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Record and Mix\u00a0 - Overtime",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Music Licensing (Stock/Original)",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Sound Effects",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Sound Design",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Digital Edit",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Remote Studio Costs",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Digital Patch: ISDN",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Digital Patch: ISDN INT'L",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Digital Patch: Source Connect",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Digital Patch: Skype / Phone",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Field Recording",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Media",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Digital File Creation",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Uploads & Machine Room",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Archive",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Audio Relay",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Facility Overtime",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Weekend Key Fee",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Transfer & Stock",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Deliveries & Messengers",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Shipping",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Inventory/Packing",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Shipping to Storage",
        "unitType": "allow"
      }
    ]
  },
  {
    "letter": "T",
    "name": "Finishing",
    "kind": "expense",
    "group": "post",
    "fringes": false,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "",
        "title": "Color Grading Prep",
        "unitType": "hrs"
      },
      {
        "no": "",
        "title": "Color Grading",
        "unitType": "hrs"
      },
      {
        "no": "",
        "title": "Pre Load/Scanning",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Data I/O",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Transfers",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Remote Set Up",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Remote Room",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Additional Machines",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Final Conform",
        "unitType": "hrs"
      },
      {
        "no": "",
        "title": "Compositing / VFX",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Flame Assistant - Roto",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "2D GFX / Design",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Motion Graphics",
        "unitType": "hrs"
      },
      {
        "no": "",
        "title": "Color Correction",
        "unitType": "hrs"
      },
      {
        "no": "",
        "title": "3D Animation",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "3D Modeling",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Archiving",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Uncompressed Files",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Retouching",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Standards Conversions",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Drives / Media",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Generic Master",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Master",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Deliverables",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Additional Outputs",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Archiving Storage Device",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Compressed File Dubs",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Postings",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Deliveries & Messengers",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Shipping",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Inventory/Packing",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Shipping to Storage",
        "unitType": "days"
      }
    ]
  },
  {
    "letter": "V",
    "name": "Miscellaneous Editorial",
    "kind": "expense",
    "group": "post",
    "fringes": false,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "",
        "title": "Storage Devices",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Archiving/LTO",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Archive Storage Devices",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Tape-to-Film Transfer",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Standards Conversion",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Stock Footage",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Satellite/Digital Transmission",
        "unitType": "hours"
      },
      {
        "no": "",
        "title": "Data Transmission Charge",
        "unitType": "flat"
      },
      {
        "no": "",
        "title": "Deliveries & Messengers",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Shipping",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Inventory/Packing",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Shipping to Storage",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Additional Machines",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Airfare",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Hotel",
        "unitType": "each"
      },
      {
        "no": "",
        "title": "Per Diem",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Transportation",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Assistant Editor Travel",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Editorial Supplies",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Equipment Rental",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Working Meals",
        "unitType": "allow"
      },
      {
        "no": "",
        "title": "Weekend Fee",
        "unitType": "flat"
      }
    ]
  },
  {
    "letter": "W",
    "name": "Editorial Labor & Creative Fees",
    "kind": "labor",
    "group": "post",
    "fringes": true,
    "handling": false,
    "subSections": false,
    "lines": [
      {
        "no": "",
        "title": "Pre-Production Labor",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Editor Labor",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Editor OT/Weekend",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Assistant Labor",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Assistant OT/Weekend",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Session Supervisory Fee",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Producer/ Coordinator",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Set Supervision",
        "unitType": "days"
      },
      {
        "no": "",
        "title": "Creative Fees",
        "unitType": "flat"
      }
    ]
  },
  {
    "letter": "X",
    "name": "Visual Effects, Design & Animation, Interactive",
    "kind": "expense",
    "group": "post",
    "fringes": false,
    "handling": false,
    "subSections": true,
    "lines": []
  }
];
