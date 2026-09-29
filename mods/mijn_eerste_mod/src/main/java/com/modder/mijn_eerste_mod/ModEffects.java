package com.modder.mijn_eerste_mod;

/**
 * Eigen status-effecten van Mijn eerste Mod – BlockyMod Studio.
 * 🎨 Alleen-visueel hoeft geen extra code; schade/genezing hebben tick-haksels
 *    (⚠️ methode-namen kunnen per mappings-versie verschillen → AI-fix).
 */
public final class ModEffects {
    private ModEffects() {}

    public static final net.minecraft.world.effect.MobEffect GLITCHEFFECT = register("glitcheffect",
            new net.minecraft.world.effect.MobEffect(net.minecraft.world.effect.MobEffectCategory.NEUTRAL, 0x1E0141));

    private static net.minecraft.world.effect.MobEffect register(String id, net.minecraft.world.effect.MobEffect effect) {
        net.minecraft.resources.ResourceKey<net.minecraft.world.effect.MobEffect> key =
                net.minecraft.resources.ResourceKey.create(net.minecraft.core.registries.BuiltInRegistries.MOB_EFFECT.key(), ModMain.id(id));
        return net.minecraft.core.registry.Registry.register(net.minecraft.core.registries.BuiltInRegistries.MOB_EFFECT, key, effect);
    }

    public static void initialize() {
        // velden hierboven registreren zichzelf bij het laden van de klasse
    }
}
