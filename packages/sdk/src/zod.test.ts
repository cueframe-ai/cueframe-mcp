import { describe, it, expect } from "vitest";
import { z } from "zod";
import * as bodySchemas from "./zod";

describe("generated zod body schemas", () => {
  it("exports applyCompositionBody as a zod object with an `ops` array", () => {
    const schema = bodySchemas.applyCompositionBody;
    expect(schema).toBeInstanceOf(z.ZodObject);
    expect(schema.shape).toHaveProperty("ops");
  });

  // Track the reviewed CompositionOp.oneOf count in api/openapi.json.
  it("exports applyCompositionOpBody as a 32-variant union (CompositionOp.oneOf, exact component.repin-v3 included)", () => {
    const schema = bodySchemas.applyCompositionOpBody;
    expect(schema).toBeInstanceOf(z.ZodUnion);
    expect(schema.options).toHaveLength(32);
    expect(
      schema.options.some(
        (option) =>
          option.safeParse({
            type: "component.repin",
            componentId: "title",
            from: "a".repeat(64),
            to: "b".repeat(64),
          }).success,
      ),
    ).toBe(false);
    const v3 = schema.options.find(
      (option) =>
        option instanceof z.ZodObject &&
        option.shape.type?.safeParse("component.repin-v3").success,
    );
    expect(v3).toBeDefined();
    expect(
      v3?.safeParse({
        type: "component.repin-v3",
        componentId: "title",
        from: "a".repeat(64),
        to: "b".repeat(64),
      }).success,
    ).toBe(false);
  });

  it("accepts the native pencil caption texture without dropping or broadening the field", () => {
    const op = {
      type: "setCaptionStyle",
      style: { annotationTexture: "pencil" },
    };
    expect(bodySchemas.applyCompositionOpBody.safeParse(op)).toMatchObject({
      success: true,
      data: op,
    });
    expect(
      bodySchemas.applyCompositionBody.safeParse({ ops: [op], dry_run: true })
        .success,
    ).toBe(true);
    expect(
      bodySchemas.applyCompositionOpBody.safeParse({
        type: "setCaptionStyle",
        style: { annotationTexture: "grainy" },
      }).success,
    ).toBe(false);
  });

  it("exports createComponentBody as a real zod object", () => {
    const schema = bodySchemas.createComponentBody;
    expect(schema).toBeInstanceOf(z.ZodObject);
    expect(Object.keys(schema.shape).length).toBeGreaterThan(0);
  });

  it("rejects a malformed composition op at parse time (typed boundary)", () => {
    const parsed = bodySchemas.applyCompositionBody.safeParse({
      ops: [{ type: "not.a.real.op" }],
    });
    expect(parsed.success).toBe(false);
  });

  it.each([24, 25, 30, 60] as const)(
    "accepts supported fps %s across generated write schemas",
    (fps) => {
      expect(
        bodySchemas.createProjectBody.safeParse({
          name: "PAL project",
          format: { aspectRatio: "16:9", fps },
        }).success,
      ).toBe(true);
      expect(
        bodySchemas.newCompositionBody.safeParse({
          format: { aspectRatio: "16:9", fps },
        }).success,
      ).toBe(true);
      expect(
        bodySchemas.applyCompositionOpBody.safeParse({
          type: "setFormat",
          format: { aspectRatio: "16:9", fps },
        }).success,
      ).toBe(true);
    },
  );

  it.each([23, 29, "25"])(
    "rejects unsupported fps %s across generated write schemas",
    (fps) => {
      expect(
        bodySchemas.createProjectBody.safeParse({
          name: "Invalid project",
          format: { aspectRatio: "16:9", fps },
        }).success,
      ).toBe(false);
      expect(
        bodySchemas.newCompositionBody.safeParse({
          format: { aspectRatio: "16:9", fps },
        }).success,
      ).toBe(false);
      expect(
        bodySchemas.applyCompositionOpBody.safeParse({
          type: "setFormat",
          format: { aspectRatio: "16:9", fps },
        }).success,
      ).toBe(false);
    },
  );

  it("preserves SceneShotSpecV2 tuple bounds and materializes its published defaults", () => {
    const op = {
      type: "scene.add",
      clipId: "shot-v2",
      newTrack: true,
      startTime: 0,
      duration: 2,
      assets: {},
      scene: {
        version: 2,
        referenceSize: { width: 1920, height: 1080 },
        backdrop: {
          kind: "radial",
          at: [0.25, 0.75],
          stops: [
            { at: 0, color: "#000000" },
            { at: 1, color: "#ffffff" },
          ],
        },
        layers: [
          {
            kind: "text",
            id: "title",
            space: "screen",
            x: 0,
            y: 0,
            lines: [{ runs: [{ text: "World objects" }] }],
            fontFamily: "Schibsted Grotesk",
            fontWeight: 700,
            fontStyle: "normal",
            fontSize: 72,
            color: "#ffffff",
          },
        ],
      },
    };
    const parsed = bodySchemas.applyCompositionOpBody.parse(op) as typeof op & {
      scene: typeof op.scene & {
        environment: { preset: string };
        post: { grain: number };
      };
    };
    expect(parsed.scene.environment.preset).toBe("soft");
    expect(parsed.scene.post.grain).toBe(0);
    expect(parsed.scene.backdrop.at).toEqual([0.25, 0.75]);
    expect(
      bodySchemas.applyCompositionOpBody.safeParse({
        ...op,
        scene: {
          ...op.scene,
          backdrop: { ...op.scene.backdrop, at: [-0.01, 0.75] },
        },
      }).success,
    ).toBe(false);
    expect(
      bodySchemas.applyCompositionOpBody.safeParse({
        ...op,
        scene: {
          ...op.scene,
          animation: [
            {
              target: { kind: "camera" },
              property: "position.z",
              keyframes: [
                { at: 0, value: 0 },
                {
                  at: 1,
                  value: 1,
                  easing: { kind: "bezier", x1: -0.01, y1: 0, x2: 1, y2: 1 },
                },
              ],
            },
          ],
        },
      }).success,
    ).toBe(false);
    expect(
      bodySchemas.applyCompositionOpBody.safeParse({
        ...op,
        scene: {
          ...op.scene,
          layers: [
            {
              kind: "group",
              id: "nested",
              children: [{ ...op.scene.layers[0], unexpected: true }],
            },
          ],
        },
      }).success,
    ).toBe(false);
    const nested = (depth: number): unknown =>
      depth === 0
        ? op.scene.layers[0]
        : {
            kind: "group",
            id: `group-${depth}`,
            children: [nested(depth - 1)],
          };
    // The kernel's own recursive components carry nesting; its group-depth
    // limit is a refinement the API enforces, not part of the JSON Schema.
    expect(
      bodySchemas.applyCompositionOpBody.safeParse({
        ...op,
        scene: { ...op.scene, layers: [nested(4)] },
      }).success,
    ).toBe(true);
  });
});
