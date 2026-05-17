import mongoose, { Schema, model } from "mongoose";

const User = model("User", new Schema({ name: String }));
const Post = model("Post", new Schema({ title: String, user: Schema.Types.ObjectId }));
const Comment = model("Comment", new Schema({ text: String, post: Schema.Types.ObjectId }));

export async function deepPopulate() {
  // MNG-POP-001: chained populates (≥3) — multiplies result graph.
  return User.find()
    .populate("posts")
    .populate("comments")
    .populate("groups")
    .exec();
}

export async function nPlusOne(ids: string[]) {
  // MNG-N1-002: findById in for-of.
  const out = [];
  for (const id of ids) {
    out.push(await User.findById(id));
  }
  return out;
}

export async function leanMissing(users: any[]) {
  // MNG-LEAN-003: iterate without .lean() + .toObject() per row.
  const out = [];
  for (const u of users) {
    out.push(u.toObject());
  }
  return out;
}

export async function whereInjection(name: string) {
  // MNG-RAW-004: $where with template interpolation (JS injection).
  return User.find({ $where: `this.name === '${name}'` });
}

export async function cleanQuery(ids: string[]) {
  // Negative: bulk find with $in operator.
  return User.find({ _id: { $in: ids } }).lean();
}
