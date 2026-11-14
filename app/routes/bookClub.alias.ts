import { redirect, type LoaderFunctionArgs } from 'react-router';

export function loader({ request }: LoaderFunctionArgs) {
  return redirect(`/book-club${new URL(request.url).search}`, 301);
}
