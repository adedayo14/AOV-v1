import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

// Simple test action without authentication
export const action = async ({ request }: ActionFunctionArgs) => {
  console.log('🧪 [TEST ACTION] Request received!');
  console.log('🧪 [TEST ACTION] Method:', request.method);
  console.log('🧪 [TEST ACTION] URL:', request.url);
  console.log('🧪 [TEST ACTION] Headers:', Object.fromEntries(request.headers.entries()));
  
  const formData = await request.formData();
  console.log('🧪 [TEST ACTION] FormData:', Object.fromEntries(formData));
  
  return json({ success: true, message: 'Test action received the request!' });
};

export default function TestAction() {
  return (
    <div>
      <h1>Test Action Page</h1>
      <form method="post">
        <input type="text" name="test" value="hello" readOnly />
        <button type="submit">Test Submit</button>
      </form>
    </div>
  );
}
