# 🎬 Animatie-prompts – g!li*tch.?

Triggers uit de app: elke 5 seconden.

## Zo werkt het
1. Vraag de AI: *"Schrijf de animatie voor `g_li_tch` die elke 5 seconden partikels en geluid geeft"*
2. De AI zet de code in deze map (pad relatief aan deze map).
3. In de app: 🤖 AI-code / GitHub → **Codes ophalen** → opnieuw exporten.

## Waar de hooks staan
- Entity-klasse: `src/main/java/.../entity/GLiTchEntity.java`
- Methode: `blockyModTriggers()` met de aangevinkte triggers
- Voorbeelden die je aan de AI kunt vragen:
  - partikels: `this.level().addParticle(ParticleTypes.CLOUD, getX(), getY(), getZ(), 0, 0.1, 0);`
  - geluid: `this.playSound(SoundEvents.ENTITY_PIG_AMBIENT, 1.0F, 1.0F);`
  - beweging in `aiStep()` (26.3) of `tickMovement()` (1.20.1)

> Klaar? Zet de bestanden in je GitHub-map en druk in de app op **Codes ophalen**. 🚀
