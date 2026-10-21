import { describe, expect, it } from "vitest";

import { applyMove, type Board } from "./use-board";

function board(): Board {
  const stage = (id: string, probability: number, position: number) => ({
    id,
    pipeline_id: "p",
    name: id,
    position,
    color: "slate",
    probability,
    kind: "open",
  });
  const deal = (id: string, stage_id: string, position: number, value: string) =>
    ({ id, stage_id, position, value, name: id, stage: null }) as unknown as Board["deals"][number];
  return {
    pipeline: { id: "p", name: "P", position: 0, stages: [stage("a", 10, 0), stage("b", 50, 1)] },
    columns: [
      { stage: stage("a", 10, 0), count: 2, total_value: "300.00", weighted_value: "30.00" },
      { stage: stage("b", 50, 1), count: 1, total_value: "50.00", weighted_value: "25.00" },
    ],
    deals: [deal("d1", "a", 0, "100"), deal("d2", "a", 1000, "200"), deal("d3", "b", 0, "50")],
  };
}

describe("applyMove", () => {
  it("moves a deal across columns and recomputes totals", () => {
    const next = applyMove(board(), "d2", "b", 0);
    const moved = next.deals.find((d) => d.id === "d2")!;
    expect(moved.stage_id).toBe("b");
    expect(moved.position).toBeLessThan(0);
    expect(next.columns[0]).toMatchObject({
      count: 1,
      total_value: "100.00",
      weighted_value: "10.00",
    });
    expect(next.columns[1]).toMatchObject({
      count: 2,
      total_value: "250.00",
      weighted_value: "125.00",
    });
  });

  it("places a deal between neighbours when reordering", () => {
    const next = applyMove(board(), "d3", "a", 1);
    expect(next.deals.find((d) => d.id === "d3")!.position).toBe(500);
  });
});
