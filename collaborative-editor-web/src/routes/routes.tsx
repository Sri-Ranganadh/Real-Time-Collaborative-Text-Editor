import { createBrowserRouter } from "react-router-dom";

export const mainRoutes = createBrowserRouter([
  { index: true, element: <>Hello</> },
  {
    element: <>Hello</>,
    path: "/",
  },
]);
