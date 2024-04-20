import Logo from "@/assets/Logo";
import AccountIcon from "@/assets/icons/AccountIcon";
import ArrowRight from "@/assets/icons/ArrowRight";
import CodeIcon from "@/assets/icons/CodeIcon";
import CollectionsIcon from "@/assets/icons/CollectionsIcon";
import DashboardIcon from "@/assets/icons/DashboardIcon";
import FeaturesIcon from "@/assets/icons/FeaturesIcon";
import IntegrationsIcon from "@/assets/icons/IntegrationsIcon";
import PricingIcon from "@/assets/icons/PricingIcon";
import SettingsIcon from "@/assets/icons/SettingsIcon";
import Link from "next/link";
import { useRouter } from "next/router";

import React from "react";

const Sidebar = () => {
	const router = useRouter();

	const NAV_ITEMS = [
		{ name: "Dashboard", icon: DashboardIcon, href: "/" },
		{ name: "Collections", icon: CollectionsIcon, href: "/collections" },
		{ name: "Accounts", icon: AccountIcon, href: "/accounts" },
		{ name: "Features", icon: FeaturesIcon, href: "/features" },
		{ name: "Pricing", icon: PricingIcon, href: "/pricing" },
		{ name: "Integrations", icon: IntegrationsIcon, href: "/integrations" },
	];
	return (
		<div className='w-[300px] pt-9 bg-[#081029] border border-[#0b1739] absolute top-0 left-0 pb-[300px]'>
			<div className='header flex items-center justify-between px-7'>
				<div className='logo flex items-center gap-2'>
					<Logo />
					<h1 className='text-white font-semibold text-[20px]'>NFT TOOLS</h1>
				</div>
				<CodeIcon />
			</div>

			<div className='mt-[42px] flex flex-col gap-1 px-7 pb-[21px] border-b border-[#FFFFFF33]'>
				{NAV_ITEMS.map((item, index) => (
					<Link
						href={item.href}
						key={index}
						className='py-4 flex gap-4 items-center'>
						<item.icon
							fill={router.asPath === item.href ? "#CB3CFF" : "#AEB9E1"}
						/>
						<h4
							className={` font-medium text-[18px] ${
								router.asPath === item.href
									? "text-[#CB3CFF]"
									: "text-[#AEB9E1]"
							}`}>
							{item.name}
						</h4>
					</Link>
				))}
			</div>
			<div className='pt-[21px] px-7'>
				<Link href='/settings' className='py-4 flex gap-4 items-center'>
					<SettingsIcon
						fill={router.asPath === "/settings" ? "#CB3CFF" : "#AEB9E1"}
					/>
					<h4
						className={` font-medium text-[18px] ${
							router.asPath === "/settings"
								? "text-[#CB3CFF]"
								: "text-[#AEB9E1]"
						}`}>
						Settings
					</h4>
				</Link>
				<button className='w-full px-3 py-[14px] bg-gradient-to-r from-[#CB3CFF] to-[#7F25FB] flex gap-2 items-center justify-center rounded text-white text-base leading-[18px] mt-16'>
					Upgrade
					<ArrowRight />
				</button>
			</div>
		</div>
	);
};

export default Sidebar;
