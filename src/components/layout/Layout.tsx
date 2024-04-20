import React, { useEffect } from "react";
import Sidebar from "./sidebar/Sidebar";

const Layout: React.FC<LayoutProps> = ({ children }) => {
	return (
		<div>
			<Sidebar />
			<div className='ml-[300px]'>{children}</div>
		</div>
	);
};

export default Layout;

interface LayoutProps {
	children?: React.ReactNode;
}
