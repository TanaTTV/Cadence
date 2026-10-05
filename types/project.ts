export interface Character { id: string; name: string; voiceId: string }
export interface DialogueTurn { id: string; characterId: string; text: string; generatedAssetId?: string }
export interface TimelineClip { id: string; assetId: string; dialogueTurnId: string; startTime: number; duration: number; gain: number }
