import React, { useEffect, useMemo } from "react";
import Sidebar from "./sidebar/Sidebar";
import { useSettingsState } from "@/store/settings.store";
import { useCollectionsState } from "@/store/collections.store";
import { useBidStateStore } from "@/store/bid.store";

const Layout: React.FC<LayoutProps> = ({ children }) => {
	const {
		rateLimit,
		apiKey,
		fundingWif,
		tokenReceiveAddress,
		bidExpiration,
		defaultLoopTime,
	} = useSettingsState();

	const { bidStates } = useBidStateStore();

	const { collections } = useCollectionsState();

	const combinedCollections = useMemo(() => {
		return collections.map((collection) => {
			const bidState = bidStates.find(
				(bid) => bid.collectionSymbol === collection.collectionSymbol
			);
			return {
				collectionSymbol: collection.collectionSymbol,
				offerType: collection.offerType,
				minBid: collection.minBid,
				maxBid: collection.maxBid,
				minFloorBid: collection.minFloorBid,
				maxFloorBid: collection.maxFloorBid,
				outBidMargin: collection.outBidMargin,
				bidCount: collection.bidCount,
				fundingWalletWIF: collection.fundingWalletWIF || fundingWif,
				tokenReceiveAddress:
					collection.tokenReceiveAddress || tokenReceiveAddress,
				duration: collection.duration || bidExpiration,
				scheduledLoop: collection.scheduledLoop || defaultLoopTime,
				running: bidState?.running || false,
				enableCounterBidding: collection.enableCounterbidding || false,
			};
		});
	}, [
		collections,
		bidStates,
		fundingWif,
		tokenReceiveAddress,
		bidExpiration,
		defaultLoopTime,
	]);

	console.log({ combinedCollections });

	useEffect(() => {
		async function startProcessing() {
			fetch("/api/bid", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					requestType: "processScheduledLoop",
					data: { apiKey, rateLimit, collections: combinedCollections },
				}),
			});
		}
		startProcessing();
	}, [apiKey, bidStates, combinedCollections, rateLimit]);

	function delay(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
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
