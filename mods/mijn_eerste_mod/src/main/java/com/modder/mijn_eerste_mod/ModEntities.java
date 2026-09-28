package com.modder.mijn_eerste_mod;

import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;
import com.modder.mijn_eerste_mod.entity.GLiTchEntity;

/**
 * Alle mobs van deze mod.
 */
public final class ModEntities {
    private ModEntities() {}

    public static final EntityType<GLiTchEntity> G_LI_TCH = register("g_li_tch",
            EntityType.Builder.<GLiTchEntity>of(GLiTchEntity::new, MobCategory.MONSTER)
                    .sized(2.40F, 6.60F)
                    .clientTrackingRange(8)
                    .updateInterval(3));

    private static <T extends net.minecraft.world.entity.Entity> EntityType<T> register(
            String path, EntityType.Builder<T> builder) {
        ResourceKey<EntityType<T>> key = ResourceKey.create(Registries.ENTITY_TYPE, ModMain.id(path));
        return Registry.register(BuiltInRegistries.ENTITY_TYPE, key, builder.build(key));
    }

    public static void initialize() {
        FabricDefaultAttributeRegistry.register(G_LI_TCH, GLiTchEntity.createAttributes());
    }
}
