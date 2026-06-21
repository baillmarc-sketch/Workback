/**
 * Authoritative AICP 2023 bid-form template, extracted from the official AICP
 * bid form (AICP_bidform_2023_update.xlsm). This is the seed structure a new
 * AICP bid starts from: the lettered cost categories A–X in canonical order,
 * their display names, whether each carries labor fringes / a handling fee, the
 * production-vs-post roll-up group, and the standard default line items for
 * each (with their unit type). Users add/rename/hide lines from here.
 *
 * Categories A–K roll into the production sub-total (subject to Production Fee &
 * Insurance per the section matrix); L/M/N/O are added below that; Q–X are the
 * post-production group (own insurance/markup/tax). X (and the P breakouts) hold
 * named sub-sections rather than a flat line list.
 */

export type AicpCategoryKind = "labor" | "expense" | "talent";
export type AicpGroup = "production" | "post";

export interface AicpTemplateLine {
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
        "title": "Line Producer",
        "unitType": "days"
      },
      {
        "title": "Assistant Director",
        "unitType": "days"
      },
      {
        "title": "Director of Photography",
        "unitType": "days"
      },
      {
        "title": "1st Assistant Camera",
        "unitType": "days"
      },
      {
        "title": "2nd Assistant Camera",
        "unitType": "days"
      },
      {
        "title": "DIT",
        "unitType": "days"
      },
      {
        "title": "Prop Master",
        "unitType": "days"
      },
      {
        "title": "Asst Props",
        "unitType": "days"
      },
      {
        "title": "Camera Op",
        "unitType": "days"
      },
      {
        "title": "Gaffer",
        "unitType": "days"
      },
      {
        "title": "Best Boy Electric",
        "unitType": "days"
      },
      {
        "title": "3rd Electric",
        "unitType": "days"
      },
      {
        "title": "Electric/Driver",
        "unitType": "days"
      },
      {
        "title": "Prep/Strike/Pre Rig Crew",
        "unitType": "days"
      },
      {
        "title": "Key Grip",
        "unitType": "days"
      },
      {
        "title": "Best Boy Grip",
        "unitType": "days"
      },
      {
        "title": "3rd Grip",
        "unitType": "days"
      },
      {
        "title": "Grip/Driver",
        "unitType": "days"
      },
      {
        "title": "Crane Tech 2x",
        "unitType": "days"
      },
      {
        "title": "Crane Head Tech",
        "unitType": "days"
      },
      {
        "title": "Steadi Cam Op",
        "unitType": "days"
      },
      {
        "title": "Choreographer",
        "unitType": "days"
      },
      {
        "title": "Make-Up/Hair",
        "unitType": "days"
      },
      {
        "title": "Make-Up/Hair Asst",
        "unitType": "days"
      },
      {
        "title": "Wardrobe Stylist",
        "unitType": "days"
      },
      {
        "title": "Asst Wardrobe",
        "unitType": "days"
      },
      {
        "title": "Script Supervisor",
        "unitType": "days"
      },
      {
        "title": "Boom Operator",
        "unitType": "days"
      },
      {
        "title": "Sound Mixer",
        "unitType": "days"
      },
      {
        "title": "VTR Operator",
        "unitType": "days"
      },
      {
        "title": "Stunt Coordinator",
        "unitType": "days"
      },
      {
        "title": "Safety Officer",
        "unitType": "days"
      },
      {
        "title": "Site Rep",
        "unitType": "days"
      },
      {
        "title": "Storyboard Artist",
        "unitType": "days"
      },
      {
        "title": "Catering Crew",
        "unitType": "days"
      },
      {
        "title": "Location Scout",
        "unitType": "days"
      },
      {
        "title": "Compliance Assistant",
        "unitType": "days"
      },
      {
        "title": "2nd AD",
        "unitType": "days"
      },
      {
        "title": "Medic",
        "unitType": "days"
      },
      {
        "title": "Craft Service",
        "unitType": "days"
      },
      {
        "title": "Firefighter",
        "unitType": "days"
      },
      {
        "title": "Police Officers/Ranger/CHP",
        "unitType": "days"
      },
      {
        "title": "Welfare/Teacher",
        "unitType": "days"
      },
      {
        "title": "Gang Boss",
        "unitType": "days"
      },
      {
        "title": "Teamster Drivers / Animal Wranglers",
        "unitType": "days"
      },
      {
        "title": "Production Supervisor",
        "unitType": "days"
      },
      {
        "title": "Assistant Production Supervisor",
        "unitType": "days"
      },
      {
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
        "title": "Line Producer",
        "unitType": "days"
      },
      {
        "title": "Assistant Director",
        "unitType": "days"
      },
      {
        "title": "Director of Photography",
        "unitType": "days"
      },
      {
        "title": "1st Assistant Camera",
        "unitType": "days"
      },
      {
        "title": "2nd Assistant Camera",
        "unitType": "days"
      },
      {
        "title": "DIT",
        "unitType": "days"
      },
      {
        "title": "Prop Master",
        "unitType": "days"
      },
      {
        "title": "Asst Props",
        "unitType": "days"
      },
      {
        "title": "Camera Op",
        "unitType": "days"
      },
      {
        "title": "Gaffer",
        "unitType": "days"
      },
      {
        "title": "Best Boy Electric",
        "unitType": "days"
      },
      {
        "title": "3rd Electric",
        "unitType": "days"
      },
      {
        "title": "Electric/Driver",
        "unitType": "days"
      },
      {
        "title": "Prep/Strike/Pre Rig Crew",
        "unitType": "days"
      },
      {
        "title": "Key Grip",
        "unitType": "days"
      },
      {
        "title": "Best Boy Grip",
        "unitType": "days"
      },
      {
        "title": "3rd Grip",
        "unitType": "days"
      },
      {
        "title": "Grip/Driver",
        "unitType": "days"
      },
      {
        "title": "Crane Tech 2x",
        "unitType": "days"
      },
      {
        "title": "Crane Head Tech",
        "unitType": "days"
      },
      {
        "title": "Steadi Cam Op",
        "unitType": "days"
      },
      {
        "title": "Choreographer",
        "unitType": "days"
      },
      {
        "title": "Make-Up/Hair",
        "unitType": "days"
      },
      {
        "title": "Make-Up/Hair Asst",
        "unitType": "days"
      },
      {
        "title": "Wardrobe Stylist",
        "unitType": "days"
      },
      {
        "title": "Asst Wardrobe",
        "unitType": "days"
      },
      {
        "title": "Script Supervisor",
        "unitType": "days"
      },
      {
        "title": "Boom Operator",
        "unitType": "days"
      },
      {
        "title": "Sound Mixer",
        "unitType": "days"
      },
      {
        "title": "VTR Operator",
        "unitType": "days"
      },
      {
        "title": "Stunt Coordinator",
        "unitType": "days"
      },
      {
        "title": "Safety Officer",
        "unitType": "days"
      },
      {
        "title": "Site Rep",
        "unitType": "days"
      },
      {
        "title": "Storyboard Artist",
        "unitType": "days"
      },
      {
        "title": "Catering Crew",
        "unitType": "days"
      },
      {
        "title": "Location Manager",
        "unitType": "days"
      },
      {
        "title": "Compliance Assistant",
        "unitType": "days"
      },
      {
        "title": "2nd AD",
        "unitType": "days"
      },
      {
        "title": "Medic",
        "unitType": "days"
      },
      {
        "title": "Craft Service",
        "unitType": "days"
      },
      {
        "title": "Firefighter",
        "unitType": "days"
      },
      {
        "title": "Police Officers/Ranger/CHP",
        "unitType": "days"
      },
      {
        "title": "Welfare/Teacher",
        "unitType": "days"
      },
      {
        "title": "Gang Boss",
        "unitType": "days"
      },
      {
        "title": "Teamster Drivers / Animal Wranglers",
        "unitType": "days"
      },
      {
        "title": "Production Supervisor",
        "unitType": "days"
      },
      {
        "title": "Assistant Production Supervisor",
        "unitType": "days"
      },
      {
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
        "title": "Craft Service",
        "unitType": "each"
      },
      {
        "title": "Per Diems",
        "unitType": "each"
      },
      {
        "title": "Hotels",
        "unitType": "each"
      },
      {
        "title": "Scouting Expenses",
        "unitType": "each"
      },
      {
        "title": "Deliveries & Taxi",
        "unitType": "allow"
      },
      {
        "title": "Car Rental",
        "unitType": "each"
      },
      {
        "title": "Trucking",
        "unitType": "each"
      },
      {
        "title": "Casting Director",
        "unitType": "days"
      },
      {
        "title": "Casting Facility",
        "unitType": "days"
      },
      {
        "title": "Home Econ Supplies",
        "unitType": "each"
      },
      {
        "title": "Telephone & Cable",
        "unitType": "each"
      },
      {
        "title": "Working Meals",
        "unitType": "each"
      },
      {
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
        "title": "Location Fees",
        "unitType": "each"
      },
      {
        "title": "Permits",
        "unitType": "each"
      },
      {
        "title": "Lane Closures",
        "unitType": "each"
      },
      {
        "title": "Set Security",
        "unitType": "each"
      },
      {
        "title": "Cargo Van",
        "unitType": "each"
      },
      {
        "title": "Production Trucking",
        "unitType": "each"
      },
      {
        "title": "Camera Truck",
        "unitType": "each"
      },
      {
        "title": "Car Rentals",
        "unitType": "each"
      },
      {
        "title": "Bus Rentals",
        "unitType": "each"
      },
      {
        "title": "Limousines",
        "unitType": "each"
      },
      {
        "title": "Dressing Room Vehicles",
        "unitType": "each"
      },
      {
        "title": "Production MoHo",
        "unitType": "each"
      },
      {
        "title": "Other Vehicles",
        "unitType": "each"
      },
      {
        "title": "Parking/Tolls/Gas",
        "unitType": "each"
      },
      {
        "title": "Excess Bags/Homeland Security",
        "unitType": "each"
      },
      {
        "title": "Air Fares",
        "unitType": "each"
      },
      {
        "title": "Hotels",
        "unitType": "each"
      },
      {
        "title": "Per Diems",
        "unitType": "each"
      },
      {
        "title": "Talent Meals",
        "unitType": "each"
      },
      {
        "title": "Breakfast",
        "unitType": "ppl"
      },
      {
        "title": "Lunch",
        "unitType": "ppl"
      },
      {
        "title": "Dinner",
        "unitType": "ppl"
      },
      {
        "title": "Cabs/ Ubers/ Lyfts / Other Transportation",
        "unitType": "each"
      },
      {
        "title": "Kit Rental",
        "unitType": "each"
      },
      {
        "title": "Art Work",
        "unitType": "each"
      },
      {
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
        "title": "Prop Rental",
        "unitType": "each"
      },
      {
        "title": "Prop Purchase",
        "unitType": "each"
      },
      {
        "title": "Prop Fabrication",
        "unitType": "each"
      },
      {
        "title": "Wardrobe Rental",
        "unitType": "each"
      },
      {
        "title": "Wardrobe Purchase",
        "unitType": "each"
      },
      {
        "title": "Costumes",
        "unitType": "each"
      },
      {
        "title": "Picture Vehicles",
        "unitType": "each"
      },
      {
        "title": "Animals & Handlers",
        "unitType": "each"
      },
      {
        "title": "Theatrical Makeup",
        "unitType": "each"
      },
      {
        "title": "Product Prep / Color Correct",
        "unitType": "each"
      },
      {
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
        "title": "Rental For Build Days",
        "unitType": "days"
      },
      {
        "title": "Build OT Hours",
        "unitType": "hrs"
      },
      {
        "title": "Rental for Pre-Lite Days",
        "unitType": "days"
      },
      {
        "title": "Pre-Lite OT Hours",
        "unitType": "days"
      },
      {
        "title": "Rental for Shoot Days",
        "unitType": "days"
      },
      {
        "title": "Shoot OT Hours",
        "unitType": "hrs"
      },
      {
        "title": "Rental for Strike Days",
        "unitType": "days"
      },
      {
        "title": "Strike OT Hours",
        "unitType": "hrs"
      },
      {
        "title": "Generator and Operator",
        "unitType": "days"
      },
      {
        "title": "Stage Manager/Studio Security",
        "unitType": "days"
      },
      {
        "title": "Power Charges",
        "unitType": "days"
      },
      {
        "title": "Misc Studio Charges",
        "unitType": "days"
      },
      {
        "title": "Meals for Crew & Talent",
        "unitType": "days"
      },
      {
        "title": "Air Conditioning",
        "unitType": "days"
      },
      {
        "title": "Crew Parking",
        "unitType": "days"
      },
      {
        "title": "Condor/Scissor Lift",
        "unitType": "days"
      },
      {
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
        "title": "Production Designer/Art Director",
        "unitType": "days"
      },
      {
        "title": "Set Decorator",
        "unitType": "days"
      },
      {
        "title": "Art Dept Coordinator",
        "unitType": "days"
      },
      {
        "title": "Prop Master",
        "unitType": "days"
      },
      {
        "title": "Asst Props",
        "unitType": "days"
      },
      {
        "title": "Swing",
        "unitType": "days"
      },
      {
        "title": "Leadman",
        "unitType": "days"
      },
      {
        "title": "Set Dresser",
        "unitType": "days"
      },
      {
        "title": "Scenics",
        "unitType": "days"
      },
      {
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
        "title": "Set Dressing Rentals",
        "unitType": "each"
      },
      {
        "title": "Set Dressing Purchases",
        "unitType": "each"
      },
      {
        "title": "Art Dept Prod Supplies",
        "unitType": "each"
      },
      {
        "title": "Art Dept Kit Rental",
        "unitType": "each"
      },
      {
        "title": "Special Effects Rental",
        "unitType": "each"
      },
      {
        "title": "Art Dept Trucking",
        "unitType": "each"
      },
      {
        "title": "Outside Construction",
        "unitType": "each"
      },
      {
        "title": "Car Prep",
        "unitType": "each"
      },
      {
        "title": "Art Dept Meals",
        "unitType": "each"
      },
      {
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
        "title": "Camera Rental",
        "unitType": "days"
      },
      {
        "title": "Sound Rental",
        "unitType": "days"
      },
      {
        "title": "Lighting Rental",
        "unitType": "days"
      },
      {
        "title": "Grip Rental",
        "unitType": "days"
      },
      {
        "title": "Generator Rental",
        "unitType": "days"
      },
      {
        "title": "Crane Rental",
        "unitType": "days"
      },
      {
        "title": "VTR Rental",
        "unitType": "days"
      },
      {
        "title": "Walkie Talkie Rental",
        "unitType": "days"
      },
      {
        "title": "Dolly Rental",
        "unitType": "days"
      },
      {
        "title": "SteadiCam",
        "unitType": "days"
      },
      {
        "title": "Helicopter",
        "unitType": "days"
      },
      {
        "title": "Production Supplies",
        "unitType": "days"
      },
      {
        "title": "Jib Arm",
        "unitType": "days"
      },
      {
        "title": "Crane Head",
        "unitType": "days"
      },
      {
        "title": "Camera Car",
        "unitType": "days"
      },
      {
        "title": "Expendables",
        "unitType": "days"
      },
      {
        "title": "Lenses",
        "unitType": "days"
      },
      {
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
        "title": "Media / Drives",
        "unitType": "each"
      },
      {
        "title": "Film",
        "unitType": "ft"
      },
      {
        "title": "Transcode / Transfer",
        "unitType": "hrs"
      },
      {
        "title": "Process",
        "unitType": "hrs"
      },
      {
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
        "title": "Petty Cash",
        "unitType": "each"
      },
      {
        "title": "Air Shipping and Carriers",
        "unitType": "each"
      },
      {
        "title": "Phones and Cables",
        "unitType": "each"
      },
      {
        "title": "Cash Under $15 Each",
        "unitType": "each"
      },
      {
        "title": "External Billing Costs",
        "unitType": "each"
      },
      {
        "title": "Special Insurance",
        "unitType": "each"
      },
      {
        "title": "Cell Phones",
        "unitType": "each"
      },
      {
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
        "title": "Director Prep",
        "unitType": "days"
      },
      {
        "title": "Director Travel",
        "unitType": "days"
      },
      {
        "title": "Director Shoot",
        "unitType": "days"
      },
      {
        "title": "Director Post",
        "unitType": "days"
      },
      {
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
        "title": "O/C Principals",
        "unitType": "days"
      },
      {
        "title": "Office Extras",
        "unitType": "days"
      },
      {
        "title": "Crowd Extras",
        "unitType": "days"
      },
      {
        "title": "General Extras",
        "unitType": "days"
      },
      {
        "title": "Hand Models",
        "unitType": "days"
      },
      {
        "title": "Voice Over",
        "unitType": "days"
      },
      {
        "title": "Fitting Fees",
        "unitType": "days"
      },
      {
        "title": "Audition Fees",
        "unitType": "days"
      },
      {
        "title": "Talent Agency Fees",
        "unitType": "each"
      },
      {
        "title": "Talent Payroll Service",
        "unitType": "each"
      },
      {
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
        "title": "Talent Air Fares",
        "unitType": "each"
      },
      {
        "title": "Talent Per Diem",
        "unitType": "each"
      },
      {
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
        "title": "File Conversion & Transcoding",
        "unitType": "hours"
      },
      {
        "title": "Breakdown",
        "unitType": "hours"
      },
      {
        "title": "Stock Footage Search",
        "unitType": "hours"
      },
      {
        "title": "Digital Dalies Transfer",
        "unitType": "hours"
      },
      {
        "title": "Transcription / Translation",
        "unitType": "allow"
      },
      {
        "title": "Offline Edit System",
        "unitType": "days"
      },
      {
        "title": "Off-Line Graphics System",
        "unitType": "days"
      },
      {
        "title": "Data Backup / Restore",
        "unitType": "allow"
      },
      {
        "title": "Conform",
        "unitType": "hours"
      },
      {
        "title": "Hi-Res Conform",
        "unitType": "hours"
      },
      {
        "title": "Mix Prep",
        "unitType": "flat"
      },
      {
        "title": "Color Prep",
        "unitType": "flat"
      },
      {
        "title": "Conform Prep",
        "unitType": "flat"
      },
      {
        "title": "Graphics Prep",
        "unitType": "flat"
      },
      {
        "title": "Remote Off-Line Edit Suite",
        "unitType": "days"
      },
      {
        "title": "Digital Media",
        "unitType": "flat"
      },
      {
        "title": "Offline Posting",
        "unitType": "flat"
      },
      {
        "title": "Backup /  Restore",
        "unitType": "flat"
      },
      {
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
        "title": "Aditional Cleanup",
        "unitType": "hours"
      },
      {
        "title": "Re-position / Re-composite",
        "unitType": "hours"
      },
      {
        "title": "Re-animate",
        "unitType": "hours"
      },
      {
        "title": "Frame Extension",
        "unitType": "hours"
      },
      {
        "title": "Pre-Roll Versions",
        "unitType": "flat"
      },
      {
        "title": "Additional Grading",
        "unitType": "hours"
      },
      {
        "title": "File Versioning / Compression",
        "unitType": "hours"
      },
      {
        "title": "Reformatting 1 x 1",
        "unitType": "hours"
      },
      {
        "title": "Reformatting 9 x 16",
        "unitType": "hours"
      },
      {
        "title": "Reformatting 4 x 3",
        "unitType": "hours"
      },
      {
        "title": "Reformatting 5 x 4",
        "unitType": "hours"
      },
      {
        "title": "Reframing 1 x 1",
        "unitType": "hours"
      },
      {
        "title": "Reframing  9 x 16",
        "unitType": "hours"
      },
      {
        "title": "Reframing  4 x 3",
        "unitType": "hours"
      },
      {
        "title": "Reframing  5 x 4",
        "unitType": "hours"
      },
      {
        "title": "Social mixes",
        "unitType": "hours"
      },
      {
        "title": "Social Music Edits",
        "unitType": "hours"
      },
      {
        "title": "Additional VO Record",
        "unitType": "hours"
      },
      {
        "title": "Additional Drives",
        "unitType": "each"
      },
      {
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
        "title": "Pre-Load, Encode and Mix Prep",
        "unitType": "hours"
      },
      {
        "title": "Sound Effects / Music Search",
        "unitType": "hours"
      },
      {
        "title": "Voice Casting",
        "unitType": "hours"
      },
      {
        "title": "Transcription / Translation",
        "unitType": "hours"
      },
      {
        "title": "VO Record",
        "unitType": "hours"
      },
      {
        "title": "ADR",
        "unitType": "hours"
      },
      {
        "title": "5.1 Mix",
        "unitType": "hours"
      },
      {
        "title": "Other Format Mixing",
        "unitType": "hours"
      },
      {
        "title": "Record and Mix",
        "unitType": "hours"
      },
      {
        "title": "Scratch Record",
        "unitType": "hours"
      },
      {
        "title": "Record and Mix\u00a0 - Overtime",
        "unitType": "hours"
      },
      {
        "title": "Music Licensing (Stock/Original)",
        "unitType": "allow"
      },
      {
        "title": "Sound Effects",
        "unitType": "hours"
      },
      {
        "title": "Sound Design",
        "unitType": "allow"
      },
      {
        "title": "Digital Edit",
        "unitType": "hours"
      },
      {
        "title": "Remote Studio Costs",
        "unitType": "hours"
      },
      {
        "title": "Digital Patch: ISDN",
        "unitType": "hours"
      },
      {
        "title": "Digital Patch: ISDN INT'L",
        "unitType": "hours"
      },
      {
        "title": "Digital Patch: Source Connect",
        "unitType": "hours"
      },
      {
        "title": "Digital Patch: Skype / Phone",
        "unitType": "hours"
      },
      {
        "title": "Field Recording",
        "unitType": "days"
      },
      {
        "title": "Media",
        "unitType": "allow"
      },
      {
        "title": "Digital File Creation",
        "unitType": "allow"
      },
      {
        "title": "Uploads & Machine Room",
        "unitType": "allow"
      },
      {
        "title": "Archive",
        "unitType": "allow"
      },
      {
        "title": "Audio Relay",
        "unitType": "each"
      },
      {
        "title": "Facility Overtime",
        "unitType": "hours"
      },
      {
        "title": "Weekend Key Fee",
        "unitType": "days"
      },
      {
        "title": "Transfer & Stock",
        "unitType": "allow"
      },
      {
        "title": "Deliveries & Messengers",
        "unitType": "allow"
      },
      {
        "title": "Shipping",
        "unitType": "allow"
      },
      {
        "title": "Inventory/Packing",
        "unitType": "allow"
      },
      {
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
        "title": "Color Grading Prep",
        "unitType": "hrs"
      },
      {
        "title": "Color Grading",
        "unitType": "hrs"
      },
      {
        "title": "Pre Load/Scanning",
        "unitType": "each"
      },
      {
        "title": "Data I/O",
        "unitType": "each"
      },
      {
        "title": "Transfers",
        "unitType": "each"
      },
      {
        "title": "Remote Set Up",
        "unitType": "each"
      },
      {
        "title": "Remote Room",
        "unitType": "each"
      },
      {
        "title": "Additional Machines",
        "unitType": "each"
      },
      {
        "title": "Final Conform",
        "unitType": "hrs"
      },
      {
        "title": "Compositing / VFX",
        "unitType": "each"
      },
      {
        "title": "Flame Assistant - Roto",
        "unitType": "each"
      },
      {
        "title": "2D GFX / Design",
        "unitType": "each"
      },
      {
        "title": "Motion Graphics",
        "unitType": "hrs"
      },
      {
        "title": "Color Correction",
        "unitType": "hrs"
      },
      {
        "title": "3D Animation",
        "unitType": "each"
      },
      {
        "title": "3D Modeling",
        "unitType": "each"
      },
      {
        "title": "Archiving",
        "unitType": "each"
      },
      {
        "title": "Uncompressed Files",
        "unitType": "each"
      },
      {
        "title": "Retouching",
        "unitType": "each"
      },
      {
        "title": "Standards Conversions",
        "unitType": "each"
      },
      {
        "title": "Drives / Media",
        "unitType": "each"
      },
      {
        "title": "Generic Master",
        "unitType": "each"
      },
      {
        "title": "Master",
        "unitType": "each"
      },
      {
        "title": "Deliverables",
        "unitType": "each"
      },
      {
        "title": "Additional Outputs",
        "unitType": "each"
      },
      {
        "title": "Archiving Storage Device",
        "unitType": "each"
      },
      {
        "title": "Compressed File Dubs",
        "unitType": "each"
      },
      {
        "title": "Postings",
        "unitType": "each"
      },
      {
        "title": "Deliveries & Messengers",
        "unitType": "days"
      },
      {
        "title": "Shipping",
        "unitType": "days"
      },
      {
        "title": "Inventory/Packing",
        "unitType": "days"
      },
      {
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
        "title": "Storage Devices",
        "unitType": "each"
      },
      {
        "title": "Archiving/LTO",
        "unitType": "allow"
      },
      {
        "title": "Archive Storage Devices",
        "unitType": "each"
      },
      {
        "title": "Tape-to-Film Transfer",
        "unitType": "hours"
      },
      {
        "title": "Standards Conversion",
        "unitType": "hours"
      },
      {
        "title": "Stock Footage",
        "unitType": "allow"
      },
      {
        "title": "Satellite/Digital Transmission",
        "unitType": "hours"
      },
      {
        "title": "Data Transmission Charge",
        "unitType": "flat"
      },
      {
        "title": "Deliveries & Messengers",
        "unitType": "allow"
      },
      {
        "title": "Shipping",
        "unitType": "allow"
      },
      {
        "title": "Inventory/Packing",
        "unitType": "allow"
      },
      {
        "title": "Shipping to Storage",
        "unitType": "allow"
      },
      {
        "title": "Additional Machines",
        "unitType": "allow"
      },
      {
        "title": "Airfare",
        "unitType": "each"
      },
      {
        "title": "Hotel",
        "unitType": "each"
      },
      {
        "title": "Per Diem",
        "unitType": "days"
      },
      {
        "title": "Transportation",
        "unitType": "allow"
      },
      {
        "title": "Assistant Editor Travel",
        "unitType": "allow"
      },
      {
        "title": "Editorial Supplies",
        "unitType": "allow"
      },
      {
        "title": "Equipment Rental",
        "unitType": "allow"
      },
      {
        "title": "Working Meals",
        "unitType": "allow"
      },
      {
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
        "title": "Pre-Production Labor",
        "unitType": "days"
      },
      {
        "title": "Editor Labor",
        "unitType": "days"
      },
      {
        "title": "Editor OT/Weekend",
        "unitType": "days"
      },
      {
        "title": "Assistant Labor",
        "unitType": "days"
      },
      {
        "title": "Assistant OT/Weekend",
        "unitType": "days"
      },
      {
        "title": "Session Supervisory Fee",
        "unitType": "days"
      },
      {
        "title": "Producer/ Coordinator",
        "unitType": "days"
      },
      {
        "title": "Set Supervision",
        "unitType": "days"
      },
      {
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
