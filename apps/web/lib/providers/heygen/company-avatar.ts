export type CompanyAvatar = Readonly<{
  displayName: string;
  providerName: string;
  groupId: string;
  preferredLooks: Readonly<{
    officeFront: string;
    officeSide: string;
    officeSideStanding: string;
    officeFrontStanding: string;
    sofaFront: string;
    sofaFrontStanding: string;
    sofaSide: string;
    sofaSideStanding: string;
  }>;
  fallbackVoiceId: string;
}>;

/**
 * Stable company presenter identity.
 *
 * HeyGen look IDs may change as the catalog evolves. Production generation
 * must resolve current looks from `groupId` and use these IDs only as ranked
 * preferences when they remain available.
 */
export const ellaAvatar: CompanyAvatar = Object.freeze({
  displayName: "Ella",
  providerName: "Masha",
  groupId: "1727064509",
  preferredLooks: Object.freeze({
    officeFront: "Masha_sitting_office_front",
    officeSide: "Masha_sitting_office_side",
    officeSideStanding: "Masha_standing_office_side",
    officeFrontStanding: "Masha_standing_office_front",
    sofaFront: "Masha_sitting_sofacasual_front",
    sofaFrontStanding: "Masha_standing_sofacasual_front",
    sofaSide: "Masha_sitting_sofacasual_side",
    sofaSideStanding: "Masha_standing_sofacasual_side",
  }),
  fallbackVoiceId: "4e5c7735901b4481ac6604de3aea6f72",
});
