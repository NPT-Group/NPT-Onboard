// src/lib/db/aggUtils.ts
import type { Document } from "mongodb";

/** $lookup that returns a single object (first match) under a given field */
export function lookupOne(params: {
  from: string;
  localField?: string;
  foreignField?: string;
  let?: Record<string, any>;
  pipeline?: Document[];
  as: string; // temporary array field
  into: string; // final single object field (usually same as `as`)
}) {
  const { from, localField, foreignField, let: vars, pipeline, as, into } = params;
  return [
    {
      $lookup: {
        from,
        ...(pipeline ? { let: vars ?? {}, pipeline, as } : { localField, foreignField, as }),
      },
    },
    { $addFields: { [into]: { $first: `$${as}` } } },
  ];
}

/** Faceted pagination with count; pass sorted pipeline parts before this stage */
export function facetPaginate(project: Document, options: { skip: number; limit: number; sort: Document }) {
  return [
    {
      $facet: {
        rows: [{ $sort: options.sort }, { $skip: options.skip }, { $limit: options.limit }, { $project: project }],
        total: [{ $count: "count" }],
      },
    },
    {
      $project: {
        rows: 1,
        total: { $ifNull: [{ $arrayElemAt: ["$total.count", 0] }, 0] },
      },
    },
  ];
}
