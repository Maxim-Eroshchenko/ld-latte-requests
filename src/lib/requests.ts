import { client } from "./supabase";
import type { RequestInput, RequestRow } from "./model";
export async function loadRequests(): Promise<RequestRow[]> {
  const { data, error } = await client()
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function loadRequest(id: string): Promise<RequestRow> {
  const { data, error } = await client()
    .from("requests")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}
export async function saveRequest(
  values: RequestInput,
  id?: string,
): Promise<RequestRow> {
  const query = id
    ? client()
        .from("requests")
        .update({
          title: values.title,
          description: values.description,
          category: values.category,
          status: values.status,
        })
        .eq("id", id)
    : client().from("requests").insert({
        title: values.title,
        description: values.description,
        category: values.category,
      });
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return data;
}
